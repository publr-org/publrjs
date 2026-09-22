// ─────────────────────────────────────────────────────────────────────────────
// PublrJS core runtime entry — SOURCE OF TRUTH: publr-js/src/ (TypeScript).
// Built to dist/publr.js by Vite, then vendored into consumers by
// scripts/vendor-publr.sh. DO NOT edit vendored copies — edit here + rebuild.
// ─────────────────────────────────────────────────────────────────────────────

import { state } from "./intrinsics";
import { createStoreContainer } from "./core/store";
import { RAW, tagStore } from "./core/symbols";
import {
  createScope,
  disposeScope,
  effect,
  getActiveScope,
  onCleanup,
  postEffect,
  runInScope,
  untrack,
} from "./core/reactivity";
import { proxyCache, reactive, unwrap } from "./core/reactive";
import { subscribe } from "./core/subscribe";
import { createLocalStore, createdStores, createStore } from "./core/store";
import { destroy, hydrate, start } from "./core/lifecycle";
import { portal, unportal } from "./core/portal";
import { ref } from "./core/ref";
import type {
  Actions,
  CreatedStore,
  LocalStoreDefinition,
  Router,
  RouterOptions,
  State,
  StoreDefinitionFactory,
  SubscribeFn,
} from "./core/types";

/**
 * Internal extension surface used by the addons (publr-query.js,
 * publr-dom.js). Not part of the public API — treat as private. A named
 * object so consumers bind by name: removing or renaming an entry fails
 * loudly at the consumer instead of silently shifting positions. The key
 * names ship un-mangled (see the note in core/types.ts) — this surface is
 * small enough that the byte cost buys the robustness.
 */
export interface PublrInternals {
  reactive: typeof reactive;
  /** SYNCHRONOUS effect — first run inline. The public export is the deferred postEffect. */
  effect: typeof effect;
  runInScope: typeof runInScope;
  onCleanup: typeof onCleanup;
  tagStore: typeof tagStore;
  unwrap: typeof unwrap;
  proxyCache: typeof proxyCache;
  RAW: typeof RAW;
  getActiveScope: typeof getActiveScope;
  createScope: typeof createScope;
  disposeScope: typeof disposeScope;
}

export interface PublrRuntime {
  state: typeof state;
  createStoreContainer: typeof createStoreContainer;
  /** @deprecated Use state(value).value in JavaScript or compiled state(value) in PTSX. */
  reactive: typeof reactive;
  ref: typeof ref;
  effect: typeof postEffect;
  portal: typeof portal;
  unportal: typeof unportal;
  hydrate: typeof hydrate;
  destroy: typeof destroy;

  /** Generate an opaque client-side id for optimistic records. */
  randomId(): string;

  /** Inside an attribute expression, the evaluating element's nearest `data-<name>`. */
  dataset(name: string): string | undefined;

  /** Create one shared store and return its flattened state/action facade. */
  createStore<S extends State = State, A extends Actions = Actions>(
    name: string,
    factory: StoreDefinitionFactory<S, A>,
  ): CreatedStore<S, A>;

  /** Register a store instantiated independently for each owning DOM root. */
  createLocalStore<S extends State = State, A extends Actions = Actions>(
    name: string,
    factory: StoreDefinitionFactory<S, A, LocalStoreDefinition<S, A>>,
  ): void;

  /** Live access to shared stores by name. */
  readonly stores: Record<string, CreatedStore>;

  /** Run `fn` with no effect tracking. Writes still trigger normally. */
  untrack<T>(fn: () => T): T;

  /**
   * Subscribe to state changes. Forms: `subscribe(fn)`, `subscribe("store", fn)`,
   * `subscribe("store.path", fn)`. Returns an unsubscribe function.
   */
  subscribe(fn: SubscribeFn): () => void;
  subscribe(selector: string, fn: SubscribeFn): () => void;

  _internals: PublrInternals;

  // ── Installed by the publr-router addon (absent until it loads) ──────────
  router?<TMeta = unknown>(options: RouterOptions<TMeta>): Router<TMeta>;
}

/** The Publr global runtime API. */
export const Publr: PublrRuntime = {
  state,
  createStoreContainer,
  reactive,
  ref,
  effect: postEffect,
  portal,
  unportal,

  /**
   * Bind directives in a DOM subtree (default: whole document). Call after
   * injecting server-rendered markup dynamically (gallery canvas, Turbo frames)
   * so newly-added `data-p-*` elements get wired. Bind each subtree once —
   * re-binding the same nodes would attach duplicate listeners.
   */
  hydrate,

  /**
   * Tear down islands in a subtree — run their cleanups (un-portal, remove
   * listeners, init cleanup), dispose their effects. Call before replacing
   * hydrated markup. Also runs automatically when a hydrated node is removed
   * from the DOM (unmount observer), so explicit calls are optional but make
   * teardown synchronous + deterministic.
   */
  destroy,

  randomId() {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 18)}`;
  },

  dataset,

  createStore,

  createLocalStore,

  get stores() {
    const out: Record<string, CreatedStore> = {};
    createdStores.forEach((store, name) => (out[name] = store));
    return out;
  },

  untrack,

  subscribe,

  _internals: {
    reactive,
    effect,
    runInScope,
    onCleanup,
    tagStore,
    unwrap,
    proxyCache,
    RAW,
    getActiveScope,
    createScope,
    disposeScope,
  },
};

export { reactive } from "./core/reactive";
export { ref } from "./core/ref";
export type { Ref } from "./core/types";
export { postEffect as effect } from "./core/reactivity";
export { portal, unportal } from "./core/portal";
export { destroy, hydrate, activate } from "./core/lifecycle";
export { createLocalStore, createStore };
export { createStoreContainer } from "./core/store";

export {
  state,
  derived,
  awaited,
  AwaitedResult,
  isPending,
  errorOf,
  refresh,
  valueOf,
  Show,
  Switch,
  Match,
  For,
  Repeat,
} from "./intrinsics";
export { Loading } from "./addons/dom";
import { dataset } from "./addons/dom";

start();

export { mutation, type MutationResult } from "./core/mutation";

export type { PortalTarget, ElementTarget } from "./core/portal";
export type { PositionBinding } from "./core/position";
