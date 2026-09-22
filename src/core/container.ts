import { createScope, disposeScope, runInScope } from "./reactivity";
import type { CreatedStore, PublrElement, StoreRef, Subscription } from "./types";

/** Explicit ownership for named state. Never an implicit current request. */
export class StoreContainer {
  readonly shared = new Map<string, StoreRef>();
  readonly created = new Map<string, CreatedStore>();
  readonly subscribers = new Set<Subscription>();
  readonly scope = runInScope(null, createScope);

  constructor(readonly root?: ParentNode) {
    this.scope.cacheBoundary = true;
    this.scope.c.push(() => this.scope.cache?.dispose());
    if (root) {
      if (roots.has(root) && !roots.get(root)!.scope.disposed)
        throw new Error("publr: app root already has a store container");
      roots.set(root, this);
    }
  }

  assertActive(): void {
    if (this.scope.disposed) throw new Error("publr: store container is disposed");
  }

  dispose(): void {
    if (this.scope.disposed) return;
    disposeScope(this.scope);
    this.shared.clear();
    this.created.clear();
    this.subscribers.clear();
    // Keep a tombstone on retired roots: they must not fall back to another app.
  }
}

const roots = new WeakMap<ParentNode, StoreContainer>();
export const browserStores = new StoreContainer();
browserStores.scope.browserDefault = true;

export function defaultStores(): StoreContainer {
  if (typeof document === "undefined") {
    throw new Error("publr: server stores require an explicit store container");
  }
  return browserStores;
}

export function containerFor(element: Element): StoreContainer {
  let node: ParentNode | null = element;
  while (node) {
    const container = roots.get(node);
    if (container) return container;
    node = (node as PublrElement)._pp?.[0] ?? node.parentNode;
  }
  return defaultStores();
}
