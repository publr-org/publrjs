// Deep reactive proxies: lazy wrapping, computed-getter memoization, and the
// RAW escape hatch.

import { RAW, STORE_TAG, getStoreTag, tagPath, tagStore } from "./symbols";
import { assertWritable, effect, track, trigger, getActiveScope, runInScope } from "./reactivity";
import { isObj } from "./util";

export const proxyCache = new WeakMap<object, any>();

/** Keys on a target that are memoized computed getters (for `isComputed`). */
export const computedKeys = new WeakMap<object, Set<PropertyKey>>();

const isPlainReactiveCandidate = (obj: object): boolean => {
  if (Array.isArray(obj)) {
    return true;
  }

  const proto = Object.getPrototypeOf(obj);

  return proto === Object.prototype || proto === null;
};

const memoizeGetter = (target: any, key: string, originalGetter: () => unknown): void => {
  let cached: unknown;

  const runner = effect(() => originalGetter.call(proxyCache.get(target) ?? target), {
    lazy: true,
    label: key,
    scheduler() {
      const next = runner();

      if (!Object.is(next, cached)) {
        const prev = cached;
        cached = next;
        trigger(target, key, prev, next);
      }
    },
  });

  // Non-null g marks the effect as a getter memo (writes inside it throw).
  runner._e.g = key;
  cached = runner();

  let keys = computedKeys.get(target);

  if (!keys) {
    computedKeys.set(target, (keys = new Set()));
  }

  keys.add(key);

  Object.defineProperty(target, key, {
    get() {
      track(target, key);
      return cached;
    },
    enumerable: true,
    configurable: true,
  });
};

const deferGetterMemoization = (target: object): void => {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(target))) {
    if (descriptor.get && !descriptor.set && descriptor.configurable) {
      // The memo binds `this` to the reactive proxy so getter dependencies stay tracked.
      // eslint-disable-next-line typescript/unbound-method
      const originalGetter = descriptor.get;
      const owner = getStoreTag(target)?.[2]?.scope ?? getActiveScope();
      queueMicrotask(() => {
        if (!owner?.disposed) runInScope(owner, () => memoizeGetter(target, key, originalGetter));
      });
    }
  }
};

/**
 * Wrap a plain object/array in a deep reactive Proxy. Nested values wrap lazily on access.
 * DOM nodes, Files, Maps, Sets, Dates, etc. pass through unwrapped.
 */
export function reactive<T>(obj: T): T;
export function reactive(obj: any): any {
  if (obj === null || !isObj(obj) || obj[RAW] || !isPlainReactiveCandidate(obj)) {
    return obj;
  }

  const cached = proxyCache.get(obj);

  if (cached) {
    return cached;
  }

  deferGetterMemoization(obj);

  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      if (key === RAW) {
        return target;
      }

      track(target, key);
      const value = Reflect.get(target, key, receiver);

      if (value && isObj(value)) {
        if (target[STORE_TAG] && !value[STORE_TAG] && isPlainReactiveCandidate(value)) {
          const parent = getStoreTag(target)!;
          tagStore(value, parent[0], tagPath(parent, key), parent[2]);
        }
      }

      return reactive(value);
    },
    set(target, key, value, receiver) {
      assertWritable();
      const oldValue = target[key];
      const oldLength = Array.isArray(target) ? target.length : -1;

      const ok = Reflect.set(target, key, value, receiver);

      if (!Object.is(oldValue, value)) {
        trigger(target, key, oldValue, value);
      }

      if (oldLength !== -1 && key !== "length" && target.length !== oldLength) {
        trigger(target, "length", oldLength, target.length);
      }

      return ok;
    },
  });

  proxyCache.set(obj, proxy);

  return proxy;
}

/** A reactive proxy's underlying target (identity for non-proxies). */
export const unwrap = (state: any): any => state?.[RAW] ?? state;
