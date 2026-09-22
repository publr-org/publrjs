// Optional dependency invalidation. Result cache objects are internal.
import { browserCache } from "../core/query-cache";
export type { CacheOptions } from "../core/query-cache";

export function invalidate(tag: string): void {
  browserCache.invalidate(tag);
}

export interface CommittedChanges {
  revision: number;
  reset: boolean;
  tags: readonly string[];
}
export interface InvalidationScope {
  invalidate(tag: string, revision?: number): void;
  invalidateAll(): void;
  readonly replayFrom?: number;
}

/** Optional revision polling; the host must return committed, authority-scoped changes. */
export function connectInvalidations(
  read: (after: number, signal: AbortSignal) => Promise<CommittedChanges>,
  options: {
    scope?: InvalidationScope;
    interval?: number;
    onError?: (error: unknown) => void;
  } = {},
): () => void {
  const scope = options.scope ?? browserCache;
  const interval = options.interval ?? 5000;
  if (!Number.isFinite(interval) || interval <= 0)
    throw new Error("publr: invalidation interval must be positive milliseconds");
  const controller = new AbortController();
  let revision: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (controller.signal.aborted) return;
    try {
      const changes = await read(revision ?? scope.replayFrom ?? 0, controller.signal);
      if (controller.signal.aborted) return;
      if (
        !Number.isSafeInteger(changes.revision) ||
        changes.revision < 0 ||
        !Array.isArray(changes.tags) ||
        !changes.tags.every((tag) => typeof tag === "string")
      )
        throw new Error("publr: invalid committed changes response");
      if (changes.reset || (revision !== undefined && changes.revision < revision))
        scope.invalidateAll();
      else for (const tag of changes.tags) scope.invalidate(tag, changes.revision);
      revision = changes.revision;
    } catch (error) {
      if (!controller.signal.aborted) options.onError?.(error);
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), interval);
    }
  };
  queueMicrotask(() => void poll());
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
