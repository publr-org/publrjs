import { prepareStore } from "./store-setup";
// Store registry: shared stores, local island definitions, SSR seeding,
// deep merge, and `watch` block wiring.
//
// The registry holds StoreRef TUPLES ([state, actions, watch?, init?] — see
// types.ts); user-facing shapes (StoreDefinition in, CreatedStore out)
// convert here at the boundary.

import { getStoreTag, tagStore } from "./symbols";
import { reactive, unwrap } from "./reactive";
import { createScope, disposeScope, effect, onCleanup, runInScope } from "./reactivity";
import { subscribeIn } from "./subscribe";
import { resolvePath } from "./parse";
import { isFn, isObj } from "./util";
import type {
  Actions,
  CreatedStore,
  LocalStoreDefinition,
  State,
  StoreDefinition,
  StoreDefinitionFactory,
  StoreParts,
  StoreRef,
  WatchSpec,
} from "./types";

export const STORE_ATTR = "data-p-store";

import { browserStores, defaultStores, containerFor, StoreContainer } from "./container";

export const sharedStores = browserStores.shared;
export const createdStores = browserStores.created;
export const localStores = new Map<
  string,
  StoreDefinitionFactory<any, any, LocalStoreDefinition>
>();

export const deepMerge = (target: any, source: any): void => {
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      isObj(sourceValue) &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      isObj(targetValue)
    ) {
      deepMerge(targetValue, sourceValue);
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(target, key);

    if (!descriptor || descriptor.writable || descriptor.set) {
      target[key] = sourceValue;
    }
  }
};

/** Deep-merge a JSON payload into (the raw target of) `state`. Bad JSON is a no-op. */
export const applyInlineSeed = (state: any, jsonText: string | null | undefined): void => {
  if (jsonText) {
    try {
      deepMerge(unwrap(state), JSON.parse(jsonText));
    } catch {}
  }
};

export const wireWatchBlock = (state: any, watchSpec: WatchSpec, el: Element | null): void => {
  const storeName = getStoreTag(unwrap(state))?.[0];

  for (const rawKey of Object.keys(watchSpec)) {
    const handler = watchSpec[rawKey];

    if (!isFn(handler)) {
      continue;
    }

    if (rawKey === "*" || rawKey.startsWith("*:")) {
      if (!storeName) {
        continue;
      }

      const filter = rawKey === "*" ? null : rawKey.slice(2);

      const unsubscribe = subscribeIn(
        getStoreTag(unwrap(state))?.[2] ?? browserStores,
        storeName,
        (change: import("./types").Change) => {
          if (filter === "static" && change.isComputed) {
            return;
          }

          if (filter === "computed" && !change.isComputed) {
            return;
          }

          handler(change.newValue, change.oldValue, { path: change.path, el });
        },
      );

      onCleanup(unsubscribe);
      continue;
    }

    for (const path of rawKey
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)) {
      let oldValue: unknown;
      let primed = false;

      effect(
        () => {
          const value = resolvePath(state, path);

          if (!primed) {
            oldValue = value;
            primed = true;
            return;
          }

          if (oldValue !== value) {
            handler(value, oldValue, { path, el });
          }

          oldValue = value;
        },
        { label: path },
      );
    }
  }
};

/** Repackage named store parts into the internal StoreRef tuple. */
export const toRef = (parts: StoreParts): StoreRef =>
  // eslint-disable-next-line typescript/unbound-method
  [parts.state, parts.actions, parts.watch, parts.init, parts.refs];

export const resolveActions = <S extends State, A extends Actions>(
  actions: A | ((context: { state: S }) => A) | undefined,
  state: S,
): A => (isFn(actions) ? actions({ state }) : (actions ?? ({} as A)));

/** Materialize a definition with a stable self-reference to its eventual state. */
export const resolveDefinition = <
  S extends State,
  A extends Actions,
  D extends Omit<StoreDefinition<S, A>, "init">,
>(
  factory: StoreDefinitionFactory<S, A, D>,
): [definition: D, target: S, bind: (state: S) => void] => {
  let current = {} as S;
  const state = new Proxy(Object.create(null), {
    get(_target, key) {
      return current[key];
    },
    set(_target, key, value) {
      (current as State)[key] = value;
      return true;
    },
    has(_target, key) {
      return key in current;
    },
  }) as S;
  const [definition, start] = prepareStore(() => factory({ state }));
  const target = (definition.state ?? {}) as S;

  current = target;

  return [
    definition,
    target,
    (next) => {
      current = next;
      start();
    },
  ];
};

/** Flatten state and actions behind one public store facade. */
const createFacade = <S extends State, A extends Actions>(
  state: S,
  actions: A,
): CreatedStore<S, A> =>
  new Proxy(Object.create(null), {
    get(_target, key) {
      return key in state ? state[key] : actions[key as string];
    },
    set(_target, key, value) {
      (state as State)[key] = value;
      return true;
    },
    has(_target, key) {
      return key in state || key in actions;
    },
    ownKeys() {
      return [...new Set([...Reflect.ownKeys(state), ...Reflect.ownKeys(actions)])];
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!(key in state) && !(key in actions)) return;
      return { enumerable: true, configurable: true };
    },
  }) as CreatedStore<S, A>;

/** Create one shared store immediately. */
export const createStore = <S extends State = State, A extends Actions = Actions>(
  name: string,
  factory: StoreDefinitionFactory<S, A>,
  container: StoreContainer = defaultStores(),
): CreatedStore<S, A> => {
  container.assertActive();
  if (container.shared.has(name)) throw new Error(`publr: duplicate store name ${name}`);
  const scope = runInScope(container.scope, createScope);
  try {
    return runInScope(scope, () => {
      const [definition, stateTarget, bindState] = resolveDefinition(factory);

      if (name) {
        tagStore(stateTarget, name, "", container);
      }

      // SSR seed: a <script id="publr-state-NAME"> JSON payload, merged before
      // the state goes reactive.
      if (name && typeof document !== "undefined") {
        applyInlineSeed(
          stateTarget,
          Array.from((container.root ?? document).querySelectorAll("script[id]")).find(
            (node) => node.id === "publr-state-" + name && containerFor(node) === container,
          )?.textContent,
        );
      }

      const state = reactive(stateTarget);

      bindState(state);

      const actions = resolveActions(definition.actions, state);

      const created = createFacade(state, actions);

      if (name) {
        container.shared.set(name, [state, actions, definition.watch, undefined, definition.refs]);
        container.created.set(name, created);
      }

      if (definition.watch) {
        const watch = definition.watch;
        queueMicrotask(() => {
          if (!scope.disposed) runInScope(scope, () => wireWatchBlock(state, watch, null));
        });
      }

      if (definition.init) {
        const cleanup = definition.init();
        if (isFn(cleanup)) onCleanup(cleanup);
      }

      for (const hook of registeredHooks) hook(name);
      return created;
    });
  } catch (error) {
    container.shared.delete(name);
    container.created.delete(name);
    disposeScope(scope);
    throw error;
  }
};

/**
 * What runs after a local store is registered: the lifecycle hydrates any root that
 * named the store before it existed (a page whose stores module evaluates after the
 * runtime's own load-time pass). Registered by the lifecycle module, which store.ts
 * cannot import.
 */
export const registeredHooks: Array<(name: string) => void> = [];

/** Register a store definition instantiated once for each owning DOM root. */
export const createLocalStore = <S extends State = State, A extends Actions = Actions>(
  name: string,
  factory: StoreDefinitionFactory<S, A, LocalStoreDefinition<S, A>>,
): void => {
  localStores.set(name, factory);

  for (const hook of registeredHooks) {
    hook(name);
  }
};

/** A browser app or server request owns this object across all async work. */
export function createStoreContainer(options: { root?: ParentNode } = {}) {
  const container = new StoreContainer(options.root);
  return {
    createStore<S extends State = State, A extends Actions = Actions>(
      name: string,
      factory: StoreDefinitionFactory<S, A>,
    ): CreatedStore<S, A> {
      return createStore(name, factory, container);
    },
    get stores(): Record<string, CreatedStore> {
      container.assertActive();
      return Object.fromEntries(container.created);
    },
    subscribe(...args: [import("./types").SubscribeFn] | [string, import("./types").SubscribeFn]) {
      return subscribeIn(container, ...args);
    },
    invalidate(tag: string, revision?: number) {
      container.assertActive();
      container.scope.cache?.invalidate(tag, revision);
    },
    invalidateAll() {
      container.assertActive();
      container.scope.cache?.invalidateAll();
    },
    get replayFrom() {
      return container.scope.cache?.replayFrom;
    },
    dispose() {
      container.dispose();
    },
  };
}
