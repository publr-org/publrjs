// Internal awaited result retention. Integration boundaries own authority scopes.
import { track, trigger } from "./reactivity";

export interface CacheOptions {
  ttl: number;
  tags?: readonly string[];
  key?: unknown;
}
export interface ResultPolicy {
  revision?: number;
  noStore?: boolean;
  revalidate?: boolean;
  expires?: number;
  tags?: readonly string[];
}
const RESULT = Symbol("publr.operationResult");
export interface OperationResult<T> {
  [RESULT]: true;
  value: T;
  policy: ResultPolicy;
}
export function operationResult<T>(value: T, policy: ResultPolicy): OperationResult<T> {
  return { [RESULT]: true, value, policy };
}
export function unpack<T>(result: T | OperationResult<T>): { value: T; policy?: ResultPolicy } {
  return result && typeof result === "object" && RESULT in result
    ? (result as OperationResult<T>)
    : { value: result as T };
}
export function structuredKey(value: unknown): string {
  const seen = new Set<object>();
  function encode(input: unknown): string {
    if (input === null || typeof input === "string" || typeof input === "boolean")
      return JSON.stringify(input);
    if (typeof input === "number" && Number.isFinite(input) && !Object.is(input, -0))
      return String(input);
    if (typeof input !== "object" || !input || seen.has(input))
      throw new Error("publr: cache keys require acyclic JSON values");
    seen.add(input);
    try {
      if (Array.isArray(input)) return "[" + Array.from(input, encode).join(",") + "]";
      if (
        Object.getPrototypeOf(input) !== Object.prototype &&
        Object.getPrototypeOf(input) !== null
      )
        throw new Error("publr: cache keys require plain objects");
      return (
        "{" +
        Object.keys(input)
          .sort()
          .map((key) => JSON.stringify(key) + ":" + encode((input as Record<string, unknown>)[key]))
          .join(",") +
        "}"
      );
    } finally {
      seen.delete(input);
    }
  }
  return encode(value);
}
interface Entry {
  value?: unknown;
  available: boolean;
  promise?: Promise<unknown>;
  stored: number;
  ttl: number;
  expires: number;
  tags: Set<string>;
  revision?: number;
}
export class ResultCache {
  private entries = new Map<string, Entry>();
  private disposed = false;
  private readers = new Map<string, number>();

  retain(key: string): () => void {
    this.readers.set(key, (this.readers.get(key) ?? 0) + 1);
    return () => {
      const count = (this.readers.get(key) ?? 1) - 1;
      if (count) this.readers.set(key, count);
      else this.readers.delete(key);
      this.prune();
    };
  }

  private prune(): void {
    // Active results retain dependency metadata; idle results have a bounded LRU.
    let inactive = [...this.entries.keys()].filter((key) => !this.readers.has(key)).length;
    for (const [key, entry] of this.entries) {
      if (this.readers.has(key) || entry.promise) continue;
      if (entry.expires <= Date.now() || inactive > 256) {
        this.entries.delete(key);
        inactive--;
      }
    }
  }

  expired(key: string): boolean {
    const entry = this.entries.get(key);
    return !!entry?.available && entry.expires > 0 && entry.expires <= Date.now();
  }
  private changes = new Map<string, { sequence: number; revision?: number }>();
  private sequence = 0;
  private epoch = 0;
  replayFrom: number | undefined;

  read<T>(key: string, run: () => T | PromiseLike<T>, options?: CacheOptions): T | Promise<T> {
    if (this.disposed) throw new Error("publr: operation scope is disposed");
    if (options && (!Number.isFinite(options.ttl) || options.ttl < 0))
      throw new Error("publr: cache ttl must be finite nonnegative milliseconds");
    track(this, key);
    this.prune();
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      for (const tag of options?.tags ?? []) entry.tags.add(tag);
      if (options) entry.ttl = Math.min(entry.ttl, options.ttl);
      if (options && entry.available)
        entry.expires = Math.min(entry.expires, entry.stored + options.ttl);
      if (entry.promise) return entry.promise as Promise<T>;
      if (entry.available && entry.expires > Date.now()) return entry.value as T;
    }
    entry = {
      available: false,
      stored: 0,
      ttl: options?.ttl ?? Infinity,
      expires: 0,
      tags: new Set(options?.tags),
    };
    this.entries.set(key, entry);
    const current = entry;
    const started = this.sequence;
    const epoch = this.epoch;
    const accept = (result: T): T => {
      const { value, policy } = unpack(result);
      if (this.entries.get(key) !== current || this.disposed) return value;
      const tags = [...current.tags, ...(policy?.tags ?? [])];
      const stale =
        epoch !== this.epoch ||
        tags.some((tag) => {
          const changed = this.changes.get(tag);
          return (
            changed &&
            (policy?.revision !== undefined && changed.revision !== undefined
              ? policy.revision < changed.revision
              : changed.sequence > started)
          );
        });
      if (stale) {
        this.entries.delete(key);
        trigger(this, key, undefined, undefined);
        throw new Error("publr: superseded dependency result");
      }
      current.revision = policy?.revision;
      current.promise = undefined;
      for (const tag of policy?.tags ?? []) current.tags.add(tag);
      if (policy?.noStore) {
        current.value = undefined;
        current.available = false;
        current.expires = 0;
      } else {
        current.value = value;
        current.available = true;
        current.stored = Date.now();
        current.expires = policy?.revalidate
          ? 0
          : Math.min(
              policy?.expires ?? Infinity,
              Number.isFinite(current.ttl) ? current.stored + current.ttl : (policy?.expires ?? 0),
            );
        for (const tag of policy?.tags ?? []) current.tags.add(tag);
      }
      return value;
    };
    const reject = (error: unknown): never => {
      if (this.entries.get(key) === current) this.entries.delete(key);
      throw error;
    };
    try {
      const result = run();
      if (result != null && typeof (result as PromiseLike<T>).then === "function") {
        current.promise = Promise.resolve(result).then(accept, reject);
        return current.promise as Promise<T>;
      }
      return accept(result as T);
    } catch (error) {
      return reject(error);
    }
  }

  refresh(key: string): void {
    // Repeated refreshes share the replacement already in flight.
    const entry = this.entries.get(key);
    if (entry?.promise) return;
    this.entries.delete(key);
    trigger(this, key, undefined, undefined);
  }

  invalidate(tag: string, revision?: number): void {
    const previous = this.changes.get(tag)?.revision;
    if (revision !== undefined && previous !== undefined && revision < previous) return;
    this.changes.set(tag, { sequence: ++this.sequence, revision });
    if (this.changes.size > 10000) {
      this.changes.clear();
      this.invalidateAll();
    }
    const keys = [...this.entries]
      .filter(
        ([, entry]) =>
          entry.tags.has(tag) &&
          !(revision !== undefined && entry.revision !== undefined && entry.revision >= revision),
      )
      .map(([key]) => key);
    // Remove every old entry before any synchronous consumer can replace it.
    for (const key of keys) this.entries.delete(key);
    for (const key of keys) trigger(this, key, undefined, undefined);
  }

  seed(
    key: string,
    value: unknown,
    expires: number,
    tags: readonly string[] = [],
    revision?: number,
    noStore = false,
  ): boolean {
    if (revision !== undefined) this.replayFrom = Math.min(this.replayFrom ?? revision, revision);
    const stale =
      this.epoch > 0 ||
      tags.some((tag) => {
        const change = this.changes.get(tag);
        return (
          change &&
          (revision === undefined || change.revision === undefined || revision < change.revision)
        );
      });
    if (stale || this.disposed) return false;
    if (this.entries.has(key)) return true;
    this.entries.set(key, {
      value: noStore ? undefined : value,
      available: !noStore,
      stored: Date.now(),
      ttl: Infinity,
      expires,
      tags: new Set(tags),
      revision,
    });
    return true;
  }

  invalidateAll(): void {
    this.epoch++;
    const keys = [...this.entries.keys()];
    this.entries.clear();
    for (const key of keys) trigger(this, key, undefined, undefined);
  }

  dispose(): void {
    this.disposed = true;
    this.entries.clear();
    this.readers.clear();
    this.changes.clear();
  }
}
export const browserCache = new ResultCache();
export function defaultCache(): ResultCache {
  if (typeof document === "undefined")
    throw new Error("publr: cached server operations require an explicit operation scope");
  return browserCache;
}
