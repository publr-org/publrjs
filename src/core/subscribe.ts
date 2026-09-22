// Global store-change subscriptions: `subscribe(fn)`, `subscribe("store", fn)`,
// `subscribe("store.path", fn)`. Hooks into the reactivity layer's trigger.
// A subscription is [matches(storeName, path), handler] — the selector is
// compiled to a matcher closure once at subscribe time.

import { getStoreTag, tagPath } from "./symbols";
import { computedKeys } from "./reactive";
import { setChangeNotifier } from "./reactivity";
import { isFn } from "./util";
import type { Change, SubscribeFn, Subscription } from "./types";

import { browserStores, defaultStores, type StoreContainer } from "./container";

setChangeNotifier((target, key, oldValue, newValue) => {
  const tag = getStoreTag(target);

  if (!tag) {
    return;
  }

  const path = tagPath(tag, key);
  const change: Change = {
    store: tag[0],
    path,
    oldValue,
    newValue,
    isComputed: !!computedKeys.get(target)?.has(key),
    source: target,
  };

  // Snapshot the set: a handler may unsubscribe (mutate globalSubscribers)
  // while we iterate.
  // eslint-disable-next-line unicorn/no-useless-spread
  for (const [matches, fn] of [...(tag[2] ?? browserStores).subscribers]) {
    if (matches(tag[0], path)) {
      fn(change);
    }
  }
});

export function subscribe(fn: SubscribeFn): () => void;
export function subscribe(selector: string, fn: SubscribeFn): () => void;
export function subscribe(...args: unknown[]): () => void {
  return subscribeIn(defaultStores(), ...args);
}

export function subscribeIn(container: StoreContainer, ...args: unknown[]): () => void {
  container.assertActive();
  const [selector, fn] = args;
  let entry: Subscription;

  if (isFn(selector)) {
    entry = [() => true, selector as SubscribeFn];
  } else if (typeof selector !== "string" || !isFn(fn)) {
    throw new Error("expected (fn) or (selector, fn)");
  } else {
    const dotIndex = selector.indexOf(".");
    const store = dotIndex < 0 ? selector : selector.slice(0, dotIndex);
    const prefix = dotIndex < 0 ? null : selector.slice(dotIndex + 1);

    entry = [
      (s, path) =>
        s === store && (prefix == null || path === prefix || path.startsWith(prefix + ".")),
      fn as SubscribeFn,
    ];
  }

  container.subscribers.add(entry);

  return () => {
    container.subscribers.delete(entry);
  };
}
