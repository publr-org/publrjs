import { afterStoreSetup } from "./store-setup";
import { withOperationSignal } from "./operation-context";
import { initial as transferred, expose } from "./transfer";
// Compiled bindings use the same dependency tracker and owners as HTML stores.
import {
  assertWritable,
  collectReadiness,
  effect,
  onCleanup,
  Pending,
  track,
  trigger,
  untrack,
  scheduleRender,
  getActiveScope,
} from "./reactivity";
import { defaultCache, structuredKey, unpack, type CacheOptions, ResultCache } from "./query-cache";
import { reactive } from "./reactive";

export interface Value<T> {
  read(): T;
  pending(): boolean;
  error(): unknown;
  isError(): boolean;
}
export interface State<T> extends Value<T> {
  value: T;
  write(value: T): T;
  update<R>(change: (value: T) => [T, R]): R;
}

export function state<T>(initial: T, id?: string): State<T> {
  const seedValue = transferred(id);
  let value = reactive(seedValue ? (seedValue.value as T) : initial);
  const binding: State<T> = {
    get value() {
      return binding.read();
    },
    set value(next: T) {
      binding.write(next);
    },
    read() {
      track(binding, "value");
      return value;
    },
    write(next) {
      assertWritable();
      const old = value;
      value = reactive(next);
      if (!Object.is(old, value)) trigger(binding, "value", old, value);
      return next;
    },
    update(change) {
      assertWritable();
      const [next, result] = change(binding.read());
      binding.write(next);
      return result;
    },
    pending: () => false,
    error: () => undefined,
    isError: () => false,
  };
  expose(id, binding);
  return binding;
}

export function derived<T>(compute: () => T, id?: string): Value<T> {
  let dirty = true;
  let value: T;
  let failure: unknown;
  let failed = false;
  let running = false;
  const refresh = () => {
    if (!dirty) return;
    if (running) throw new Error("Cyclic derived dependency");
    running = true;
    dirty = false;
    try {
      value = runner() as T;
      failed = false;
      failure = undefined;
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      running = false;
    }
  };
  const check = () => {
    refresh();
    if (failed) throw failure;
  };
  const binding: Value<T> = {
    read() {
      track(binding, "value");
      collectReadiness(check);
      check();
      return value;
    },
    pending() {
      track(binding, "value");
      refresh();
      return failed && failure instanceof Pending;
    },
    isError() {
      track(binding, "value");
      refresh();
      return failed && !(failure instanceof Pending);
    },
    error() {
      track(binding, "value");
      refresh();
      return failure instanceof Pending ? undefined : failure;
    },
  };
  const runner = effect(compute, {
    lazy: true,
    invalidate() {
      if (dirty) return;
      dirty = true;
      trigger(binding, "value", undefined, undefined);
    },
  });
  runner._e.g = "derived";
  onCleanup(() => {
    dirty = false;
  });
  expose(id, binding);
  return binding;
}

export interface AwaitedOptions<T> {
  initial?: T;
  cache?: CacheOptions | (() => CacheOptions);
  key?: () => unknown;
  resultCache?: ResultCache;
  id?: string;
  /** Seed arguments are read without executing the operation during hydration. */
  inputs?: () => unknown;
}
export interface AsyncValue<T> extends Value<T> {
  /** Latest successful result, retained during a later request. */
  peek(): T | undefined;
  loaded(): boolean;
  refresh(): void;
}

export function awaited<T>(
  operation: () =>
    | T
    | import("./query-cache").OperationResult<T>
    | PromiseLike<T | import("./query-cache").OperationResult<T>>,
  options: AwaitedOptions<T> = {},
): AsyncValue<T> {
  let value: T;
  const seedValue = transferred(options.id);
  if (seedValue) options = { ...options, initial: seedValue.value as T };
  let available = Object.hasOwn(options, "initial");
  if (available) value = options.initial as T;
  let pending = !available;
  let failure: unknown;
  let failed = false;
  let dirty = true;
  let disposed = false;
  let ready = false;
  let generation = 0;
  let controller: AbortController | undefined;
  let seed = available;
  let cacheKey: string | undefined;
  let cache: ResultCache | undefined;
  let releaseCache: (() => void) | undefined;
  const retainCache = (next: ResultCache | undefined, key: string | undefined) => {
    if (cache === next && cacheKey === key) return;
    releaseCache?.();
    cache = next;
    cacheKey = key;
    releaseCache = next && key !== undefined ? next.retain(key) : undefined;
  };
  let cacheOwner = getActiveScope();
  while (cacheOwner && !cacheOwner.cacheBoundary) cacheOwner = cacheOwner.parent ?? null;
  const ownedCache = () =>
    options.resultCache ??
    (cacheOwner
      ? (cacheOwner.cache ??= cacheOwner.browserDefault ? defaultCache() : new ResultCache())
      : defaultCache());
  const suspension = new Pending();
  const notify = () => trigger(binding, "value", undefined, undefined);
  const invalidate = () => {
    if (dirty || disposed) return;
    dirty = true;
    failed = false;
    failure = undefined;
    pending = true;
    generation++;
    controller?.abort();
    notify();
    scheduleRender(() => {
      if (!disposed) untrack(ensure);
    });
  };
  const settle = (version: number, success: boolean, result: unknown) => {
    if (disposed || version !== generation) return;
    pending = false;
    failed = !success;
    failure = success ? undefined : result;
    if (success) {
      value = reactive(unpack(result as T).value);
      available = true;
    }
    notify();
  };
  const runner = effect(
    () => {
      if (seed) {
        seed = false;
        options.inputs?.();
        if (seedValue?.cache) {
          retainCache(ownedCache(), structuredKey(seedValue.cache.key));
          const accepted = cache!.seed(
            cacheKey!,
            value,
            seedValue.cache.expires,
            seedValue.cache.tags,
            seedValue.cache.revision,
            seedValue.cache.noStore,
          );
          track(cache!, cacheKey!);
          if (!accepted) scheduleRender(invalidate);
        }
        return;
      }
      const version = ++generation;
      failed = false;
      failure = undefined;
      try {
        const policy = typeof options.cache === "function" ? options.cache() : options.cache;
        const identity = policy?.key ?? options.key?.();
        if (policy && identity === undefined)
          throw new Error("publr: cached callbacks require a structured key");
        retainCache(
          identity === undefined ? undefined : ownedCache(),
          identity === undefined ? undefined : structuredKey(identity),
        );
        const result =
          cache && cacheKey !== undefined
            ? cache.read(cacheKey, operation, policy)
            : withOperationSignal((controller = new AbortController()).signal, operation);
        if (result != null && typeof (result as PromiseLike<T>).then === "function") {
          pending = true;
          Promise.resolve(result).then(
            (v) => settle(version, true, v),
            (e) => settle(version, false, e),
          );
        } else settle(version, true, result);
      } catch (error) {
        if (error instanceof Pending) {
          pending = true;
          return;
        }
        settle(version, false, error);
      }
    },
    { lazy: true, invalidate },
  );
  const ensure = () => {
    if (!ready || !dirty || disposed) return;
    dirty = false;
    runner();
  };
  const check = () => {
    if (!pending && !dirty && cache && cacheKey !== undefined && cache.expired(cacheKey))
      invalidate();
    ensure();
    if (pending) throw suspension;
    if (failed) throw failure;
  };
  const binding: AsyncValue<T> = {
    peek() {
      track(binding, "value");
      ensure();
      return available ? value : undefined;
    },
    loaded() {
      track(binding, "value");
      ensure();
      return available;
    },
    read() {
      track(binding, "value");
      collectReadiness(check);
      check();
      return value;
    },
    pending() {
      track(binding, "value");
      ensure();
      return pending;
    },
    isError() {
      track(binding, "value");
      ensure();
      return failed;
    },
    error() {
      track(binding, "value");
      ensure();
      return failure;
    },
    refresh() {
      seed = false;
      if (cache && cacheKey !== undefined) cache.refresh(cacheKey);
      invalidate();
      untrack(ensure);
    },
  };
  onCleanup(() => {
    disposed = true;
    controller?.abort();
    releaseCache?.();
    generation++;
  });
  // Store definitions may refer to state that is not bound until the factory returns.
  afterStoreSetup(() => {
    ready = true;
    untrack(ensure);
  });
  expose(options.id, binding);
  return binding;
}

export const isPending = (value: Value<unknown>): boolean => value.pending();
export const errorOf = (value: Value<unknown>): unknown => value.error();
export const refresh = (value: AsyncValue<unknown>): void => value.refresh();

/** Accessors preserve binding identity; reactive() must not memoize them again. */
export function bindings(values: Record<string, Value<unknown>>): Record<string, unknown> {
  const result = Object.create(null) as Record<string, unknown>;
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(result, name, {
      enumerable: true,
      configurable: false,
      get: () => value.read(),
      set: "write" in value ? (next) => (value as State<unknown>).write(next) : undefined,
    });
  }
  return result;
}

export const valueOf = <T>(value: Value<T>): T => value.read();
export const isError = (value: Value<unknown>): boolean => value.isError();
