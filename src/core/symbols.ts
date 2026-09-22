// Identity symbols shared across the runtime, plus store tagging.

import type { StoreTag } from "./types";

/** Proxy escape hatch: `proxy[RAW]` returns the underlying target. */
export const RAW: unique symbol = Symbol();

/** Stamped on store state objects: [store, path] for subscriber routing. */
export const STORE_TAG: unique symbol = Symbol();

export const getStoreTag = (target: unknown): StoreTag | undefined =>
  target && typeof target === "object" ? (target as any)[STORE_TAG] : undefined;

/** `tag`'s path extended by one key — the dotted path of `key` under the tag. */
export const tagPath = (tag: StoreTag, key: PropertyKey): string =>
  tag[1] ? tag[1] + "." + String(key) : String(key);

export const tagStore = (
  target: unknown,
  storeName: string,
  path: string,
  container?: StoreTag[2],
): void => {
  const existing = getStoreTag(target);
  if (existing?.[2] && container && existing[2] !== container) {
    throw new Error("publr: store factories must return fresh mutable state for each container");
  }
  if (!target || typeof target !== "object" || existing) {
    return;
  }

  try {
    Object.defineProperty(target, STORE_TAG, {
      value: [storeName, path, container] satisfies StoreTag,
      configurable: true,
    });
  } catch {}
};

/** Generated HTML stores use the shared staged render scheduler. */
export const HTML_STORE = Symbol("publr.html-store");
