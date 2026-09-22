// Shared types for the PublrJS runtime. Types only — no runtime code, so any
// module (core or addon) may import from here without affecting chunking.
//
// NOTE ON SHORT FIELD NAMES / TUPLES: the size budget for dist/publr.js is
// measured as esbuild-minify + gzip, and esbuild does NOT mangle property
// names — every property name in the source ships verbatim in the minified
// bundle. Shapes that are internal to the runtime therefore use 1–2 char
// fields or positional tuples, documented once here; anything a consumer can
// touch keeps full names (StoreDefinition, CreatedStore, Change, …), and the
// runtime converts at the boundary.

export interface EffectOptions {
  /** Invalidate cached computations synchronously; evaluation remains lazy. */
  invalidate?: () => void;
  /** Skip the initial run — the effect first executes via its runner/scheduler. */
  lazy?: boolean;
  /** Replaces `run()` when the effect is queued by the flush loop. */
  scheduler?: (() => void) | null;
  /** Name used in infinite-update-loop errors. */
  label?: string | null;
}

export interface EffectContext {
  /** True only for this effect instance's first execution. */
  isInitial: boolean;
  /** Zero-based execution count. */
  run: number;
}

export type AuthoredEffect = (context: EffectContext) => unknown;

/** Internal effect node (field names hand-minified — see note above). */
export interface EffectRecord {
  invalidate?: () => void;
  /** Readiness checks collected by graph reads, separate from ownership. */
  readiness?: Set<() => void>;
  /** deps: every dep Set this effect is registered in (for O(1) unsubscribe). */
  d: Array<Set<EffectRecord>>;
  /** disposed. */
  x: boolean;
  /** label (from EffectOptions.label) — shown in infinite-loop errors. */
  l: string | null;
  /** scheduler (from EffectOptions.scheduler) — replaces run when queued. */
  s: (() => void) | null;
  /** computed-getter name; non-null also marks this effect AS a getter memo. */
  g: string | null;
  /** run: (re)execute now, returns the last value. Never reads `this`. */
  r(this: void): unknown;
}

export type EffectRunner = (() => unknown) & {
  /** The effect record behind this runner (internal). */
  _e: EffectRecord;
};

/** Internal effect scope: `e` = effects, `c` = cleanups. */
export interface Scope {
  cache?: import("./query-cache").ResultCache;
  cacheBoundary?: boolean;
  browserDefault?: boolean;
  parent?: Scope | null;
  children?: Set<Scope>;
  paused?: boolean;
  disposed?: boolean;
  e: EffectRecord[];
  c: Array<() => void>;
}

/** Identity tag stamped on store state objects: [storeName, pathPrefix]. */
export type StoreTag = [
  store: string,
  path: string,
  container?: import("./container").StoreContainer,
];

export type State = Record<PropertyKey, any>;
export type Actions = Record<string, any>;
export type Ref<T extends Element | null = Element | null> = ((value: T) => void) & { current: T };
export type Refs = Record<string, Ref<any>>;

export type WatchHandler = (
  newValue: unknown,
  oldValue: unknown,
  ctx: { path: string; el: Element | null },
) => void;

export type WatchSpec = Record<string, WatchHandler>;

export type InitFn = (ctx: { el: Element }) => void | (() => void);

/**
 * INTERNAL store currency: [state, actions, watch?, init?]. User-authored
 * definitions/factories and everything the public API returns keep the named
 * Public definitions/facades use named fields; the runtime repackages them
 * into this tuple once at registration.
 */
export type StoreRef = [
  state: State,
  actions: Actions,
  watch?: WatchSpec,
  init?: InitFn,
  refs?: Refs,
];

/** Named parts used to build the runtime's internal store tuple. */
export interface StoreParts {
  state: State;
  actions: Actions;
  watch?: WatchSpec;
  init?: InitFn;
  refs?: Refs;
}

export interface StoreContext<S extends State = State> {
  state: S;
}

export type ActionsFactory<S extends State = State, A extends Actions = Actions> = (
  context: StoreContext<S>,
) => A;

export interface StoreDefinition<S extends State = State, A extends Actions = Actions> {
  state?: S;
  actions?: A | ActionsFactory<S, A>;
  watch?: WatchSpec;
  refs?: Refs;
  /** Runs once after this shared store is registered. May return cleanup. */
  init?: () => void | (() => void);
}

export interface LocalStoreDefinition<
  S extends State = State,
  A extends Actions = Actions,
> extends Omit<StoreDefinition<S, A>, "init"> {
  actions?: A | ActionsFactory<S, A>;
  init?: InitFn;
}

export type StoreDefinitionFactory<
  S extends State = State,
  A extends Actions = Actions,
  D extends Omit<StoreDefinition<S, A>, "init"> = StoreDefinition<S, A>,
> = (context: StoreContext<S>) => D;

export type CreatedStore<S extends State = State, A extends Actions = Actions> = S & A;

export interface Change {
  store: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  isComputed: boolean;
  source: object;
}

export type SubscribeFn = (change: Change) => void;

/** A live subscription: [matches(storeName, path), handler]. */
export type Subscription = [(store: string, path: string) => boolean, SubscribeFn];

// ── Router addon specs ────────────────────────────────────────────────

export type ScrollPolicy = "top" | "preserve" | "restore";

export interface RouteDefinition<TMeta = unknown> {
  path: string;
  id: string;
  children?: RouteDefinition<TMeta>[];
  meta?: TMeta;
  scroll?: ScrollPolicy;
  load?: (ctx: RouteLoadContext<TMeta>) => unknown;
}

export interface RouteMatch<TMeta = unknown> {
  id: string;
  path: string;
  params: Record<string, string>;
  meta?: TMeta;
  route: RouteDefinition<TMeta>;
}

export interface RouteLoadContext<TMeta = unknown> {
  url: URL;
  params: Record<string, string>;
  search: URLSearchParams;
  signal: AbortSignal;
  match: RouteMatch<TMeta>;
  matches: RouteMatch<TMeta>[];
}

export interface RouterCurrent<TMeta = unknown> {
  url: URL;
  pathname: string;
  params: Record<string, string>;
  search: URLSearchParams;
  hash: string;
  matches: RouteMatch<TMeta>[];
  status: "idle" | "loading" | "ready" | "error";
  error: unknown;
}

export interface NavigateOptions {
  replace?: boolean;
  scroll?: ScrollPolicy;
  state?: unknown;
}

export interface RouterOptions<TMeta = unknown> {
  /** Manual waits for router.commit() after delayed view readiness. Default: automatic. */
  commit?: "automatic" | "manual";
  routes: RouteDefinition<TMeta>[];
  base?: string;
  scroll?: ScrollPolicy;
}

export interface Router<TMeta = unknown> {
  current: RouterCurrent<TMeta>;
  start(): Router<TMeta>;
  navigate(href: string | URL, options?: NavigateOptions): Promise<void>;
  replace(href: string | URL, options?: Omit<NavigateOptions, "replace">): Promise<void>;
  prefetch(href: string | URL, options?: { signal?: AbortSignal }): Promise<unknown[]>;
  /** Apply pending scroll after application-owned route DOM has committed. */
  commit(): void;
  destroy(): void;
}

/**
 * Expando properties the runtime stores directly on DOM nodes. Cast through
 * this at the boundaries instead of augmenting the global Element interface.
 * Short names ship un-mangled (see note at top); the `_p*` prefix stays clear
 * of consumer-owned expandos (`_publrInit`, `_publrOnClose`, …).
 */
export interface PublrElement extends HTMLElement {
  /** Island store ref (local-factory islands and @for row islands). */
  _ps?: StoreRef | null;
  /** Island sCope — effects/cleanups torn down on unmount. */
  _pc?: Scope | null;
  /** Structural template already bound (data-p-for). */
  _pb?: boolean;
  /**
   * Portal state while portaled: [authored parent, authored next sibling,
   * added `.dark`?]. Ref resolution walks the authored parent back-link.
   */
  /** Non-serialized portal/position values, shared by DOM writes and HTML wiring. */
  _pv?: Map<string, unknown>;
  _pp?: [ParentNode | null, ChildNode | null, boolean?] | null;
  /** data-p-portal Wiring done. */
  _pw?: boolean;
  /**
   * Directive suffixes already wired on this element ("on", "text", …), so
   * overlapping hydrate() passes never wire the same directive twice. Each
   * marker registers a cleanup in its owning island scope, so destroying the
   * island clears it and a later hydrate re-wires against the new instance.
   */
  _pd?: Set<string>;
}
