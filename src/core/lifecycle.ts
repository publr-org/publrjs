import { compiledFactories } from "./component-metadata";
// Island lifecycle: instantiate local stores, hydrate directives in a subtree,
// wire markup that arrives later and tear islands down when it leaves (both
// automatically, via the lifecycle observer; destroy() is the explicit form).
// Owns the single wiring table (attribute suffix -> wire function) so every
// data-p-* literal lives in one place.

import { containerFor } from "./container";
import { seedText } from "./text-seed";
import { tagStore } from "./symbols";
import { reactive } from "./reactive";
import { createScope, disposeScope, onCleanup, runInScope, untrack } from "./reactivity";
import {
  STORE_ATTR,
  applyInlineSeed,
  localStores,
  registeredHooks,
  resolveActions,
  resolveDefinition,
  toRef,
  wireWatchBlock,
} from "./store";
import {
  wireBind,
  wireClass,
  wireModel,
  wireOn,
  wireShow,
  wireStyle,
  wireText,
} from "./directives";
import { setupFor, setupIf } from "./structural";
import { wirePortal } from "./portal";
import { wirePosition } from "./position";
import { wireRef } from "./ref";
import { wireFocus } from "./focus";
import { ga, isFn } from "./util";
import type { PublrElement } from "./types";

export const elementsWithAttr = (root: ParentNode, attr: string): Iterable<Element> => {
  const descendants = root.querySelectorAll(`[${attr}]`);

  return root.nodeType === 1 && ga(root as Element, attr) != null
    ? [root as Element, ...descendants]
    : descendants;
};

const instantiateIslands = (root: ParentNode): void => {
  for (const element of elementsWithAttr(root, STORE_ATTR)) {
    const el = element as PublrElement;
    const name = ga(el, STORE_ATTR);

    if (!name) {
      continue;
    }

    if (activationHeld(el) || insidePending(el, true)) continue;
    const container = containerFor(el);
    if (container.scope.disposed) continue;
    const inlineSeed = ga(el, "data-p");

    // A root instantiated by other means (a for-loop clone carrying its alias store)
    // was never waiting for anything.
    if (el._ps) {
      pendingRoots.delete(el);
      continue;
    }

    const factory = localStores.get(name);

    if (!factory) {
      const entry = container.shared.get(name);

      if (entry) {
        pendingRoots.delete(el);
        applyInlineSeed(entry[0], inlineSeed);
        el._ps = entry;
        el._pc = runInScope(container.scope, createScope);
        el._pc.c.push(() => {
          el._ps = null;
          el._pc = null;
        });
      } else {
        // The store is not registered yet — its module may still be loading behind
        // the runtime's own pass. Wiring the subtree now would bind its directives
        // to nothing and mark them done; leave it, remember it, and hydrate it when
        // the store arrives.
        rememberPending(name, el);
      }

      continue;
    }

    pendingRoots.delete(el);

    // Each local island owns a scope stored on its root. Its init() teardown,
    // effects, event-listener removers, and portal restores all register into
    // this scope (this instantiation runs inside it, and hydrate wires the
    // island's directives inside it too), so `destroy()` / the unmount observer
    // can tear the whole island down — including un-portaling content back out
    // of <body> — when its root leaves the DOM.
    // A compiled parent may already have hydrated this child root. Its HTML
    // adapter must share that lifetime, not instantiate a second component.
    const scope = el._pc ?? runInScope(container.scope, createScope);
    el._pc = scope;
    scope.c.push(() => {
      el._ps = null;
      el._pc = null;
    });

    runInScope(scope, () => {
      const [definition, stateTarget, bindState] = resolveDefinition(factory);
      if (!compiledFactories.has(factory)) seedText(el, stateTarget);

      tagStore(stateTarget, name, "", container);

      const localState = reactive(stateTarget);

      if (!compiledFactories.has(factory)) applyInlineSeed(localState, inlineSeed);
      bindState(localState);

      const localActions = resolveActions(definition.actions, localState);
      const ref = toRef({
        state: localState,
        actions: localActions,
        watch: definition.watch,
        init: definition.init,
        refs: definition.refs,
      });
      const [state, , watch, init] = ref;

      el._ps = ref;

      if (watch) {
        wireWatchBlock(state, watch, el);
      }

      if (isFn(init)) {
        const teardown = init({ el });

        if (isFn(teardown)) {
          onCleanup(teardown);
        }
      }
    });
  }
};

// Roots waiting for their local store: the set, and the same roots by store name.
// Kept here rather than on the elements so that only this runtime instance's own
// pass can hold a root back (a second instance on the page must not).
const pendingRoots = new WeakSet<Element>();
const pendingIslands = new Map<string, Set<Element>>();

const rememberPending = (name: string, el: Element): void => {
  let roots = pendingIslands.get(name);

  if (!roots) {
    roots = new Set();
    pendingIslands.set(name, roots);
  }

  roots.add(el);
  pendingRoots.add(el);
};

// Whether an element sits inside a root still waiting for its store (or is one):
// its directives are not wired until that root is.
const insidePending = (el: Element, skipSelf = false): boolean => {
  if (el.closest("[data-p-for-key], [data-p-if-row]")) return true;
  let node: Element | null = el;

  while (node) {
    if (
      (!skipSelf || node !== el) &&
      (pendingRoots.has(node) || (node.hasAttribute("data-p-store") && !(node as PublrElement)._ps))
    )
      return true;
    // Structural roots (including table rows) use sibling template boundaries.
    // Their descendants must wait for the owner just like element-root children.
    let depth = 0;
    for (
      let sibling = node.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      if (sibling.hasAttribute("data-p-root-end")) depth++;
      if (sibling.hasAttribute("data-p-root-start")) {
        if (depth > 0) depth--;
        else if (pendingRoots.has(sibling)) return true;
      }
    }
    node = node.parentElement;
  }

  return false;
};

// A local store was registered: every root that named it before is hydrated now,
// subtree included, exactly as markup arriving later is.
const hydratePending = (name: string): void => {
  const roots = pendingIslands.get(name);

  if (!roots) return;

  pendingIslands.delete(name);

  for (const root of roots) {
    pendingRoots.delete(root);

    if (root.isConnected) {
      hydrate(root);
    }
  }
};

registeredHooks.push(hydratePending);

// Nearest enclosing island scope for an element, so a directive's cleanups
// (listeners, portal restore, effects) are torn down when that island unmounts.
// Returns null for directives outside any local island (they wire at no scope,
// exactly as before — nothing persistent to tear down).
const scopeForEl = (el: Element) => {
  let node: Element | null = el;

  while (node) {
    const scope = (node as PublrElement)._pc;
    if (scope) return scope;
    const portalParent: ParentNode | null | undefined = (node as PublrElement)._pp?.[0];
    node = portalParent instanceof Element ? portalParent : node.parentElement;
  }

  return null;
};

// Dispose one island's scope: runs its cleanups (un-portal, remove listeners,
// init teardown) and disposes its effects. Idempotent.
const disposeIsland = (element: Element): void => {
  const el = element as PublrElement;

  if (el._pc) {
    disposeScope(el._pc);
    el._pc = null;
    el._ps = null;
    el._pw = false;
  }
};

/**
 * Tear down every island in a subtree (and the root itself if it is one),
 * running their cleanups — including un-portaling content back out of <body>.
 * Call before replacing server-rendered markup (gallery canvas, Turbo
 * `before-render`); the lifecycle observer also calls it automatically when a
 * hydrated node is removed from the DOM.
 */
export const destroy = (root: Node = document): void => {
  if (!root || ![1, 9, 11].includes(root.nodeType)) return;
  if (root.nodeType === 1) disposeIsland(root as Element);

  for (const el of (root as Element).querySelectorAll(`[${STORE_ATTR}]`)) {
    disposeIsland(el);
  }
  for (const [name, roots] of pendingIslands) {
    for (const el of roots)
      if (el === root || root.contains(el)) {
        roots.delete(el);
        pendingRoots.delete(el);
      }
    if (!roots.size) pendingIslands.delete(name);
  }
};

// Automatic mount and unmount: wire markup that arrives, dispose islands whose
// root leaves. Both halves are the runtime's business, not a component's — a
// component author writes markup with `data-p-*` attributes and a store, and
// never reaches for `hydrate` to make either happen.
//
// The mount half is what makes markup injected after the load pass work at
// all: an island's fragment patched into the page, a repeater row, a panel
// swapped in by a router. Without it every producer of late markup would have
// to know to call `hydrate`, which pushes a lifecycle concern out to every
// call site that inserts a node.
let lifecycleObserver: MutationObserver | null = null;

const ensureLifecycleObserver = (): void => {
  if (lifecycleObserver || typeof MutationObserver === "undefined") return;

  lifecycleObserver = new MutationObserver((mutations) => {
    // Added nodes are collected and wired after every removal in the batch has
    // been processed, so markup that replaces other markup — the common case:
    // a fragment patched over a placeholder — tears the old islands down
    // before the new ones are instantiated.
    const added: Element[] = [];

    for (const m of mutations) {
      m.removedNodes.forEach((node) => {
        // A MOVE (insertBefore/appendChild of an existing node — repeater row
        // reorders, portal lifts) reports the node as removed even though it
        // was immediately re-inserted elsewhere. By the time this callback
        // runs (a microtask after the mutation) a genuinely unmounted node is
        // disconnected while a moved one is connected again — leave the moved
        // one's islands (and its portaled content's islands) alone.
        if (node.isConnected) return;
        destroy(node);
      });

      m.addedNodes.forEach((node) => {
        // Elements only, and only ones still in the document by the time this
        // callback runs — the mirror of the move test above.
        if (node.nodeType !== 1 || !node.isConnected) return;
        added.push(node as Element);
      });
    }

    // `hydrate` is idempotent per element and per directive, so a node that
    // was already wired (its own hydrate pass, or a move) costs a walk and
    // nothing else — and the insertions hydrate itself makes (repeater rows,
    // portal relocations) settle on the next batch instead of looping.
    for (const node of added) hydrate(node);
  });

  lifecycleObserver.observe(document, {
    childList: true,
    subtree: true,
  });
};

// Everything one hydrate pass wires, in order: attribute directives, then
// structural <template>s, then anchored positioning and portals. Positioning
// registers while the panel is still discoverable inside a subtree hydration;
// its deferred frame runs after portal relocation. Portal otherwise remains
// last so the element and subtree are fully wired before relocation.
const WIRING: Array<[string, (el: Element, attr: string) => void]> = [
  ["if", setupIf],
  ["on", wireOn],
  ["text", wireText],
  ["show", wireShow],
  ["class", wireClass],
  ["focus", wireFocus],
  ["bind", wireBind],
  ["ref", wireRef],
  ["style", wireStyle],
  ["model", wireModel],
  ["for", setupFor],
  ["position", wirePosition],
  ["portal", wirePortal],
];

/**
 * Bind directives in a DOM subtree to the registered stores. Instantiates local-factory
 * islands, wires each directive, and expands structural `<template>`s. Each island's
 * directives wire inside that island's scope so they tear down together on unmount.
 *
 * Idempotent per element and directive: overlapping passes (a subtree hydrate
 * followed by the load-time document hydrate, injected-markup re-passes) skip
 * already-wired directives instead of stacking duplicate listeners/effects.
 * Destroying an island clears its elements' markers, so hydrating the same
 * markup again wires it to the freshly instantiated island.
 */
export const hydrate = (
  root: ParentNode = document,
  options?: { deferMount?: boolean; bindingsOnly?: boolean },
): ParentNode => {
  if (!options?.bindingsOnly) instantiateIslands(root);

  for (const [suffix, wire] of WIRING) {
    if (options?.deferMount && ["ref", "focus", "position", "portal"].includes(suffix)) continue;
    const attr = "data-p-" + suffix;

    for (const el of elementsWithAttr(root, attr)) {
      if (insidePending(el) || activationHeld(el) || containerFor(el).scope.disposed) {
        continue;
      }

      let waiting = false;
      for (const match of (ga(el, attr) ?? "").matchAll(/\$?([A-Za-z_][\w-]*)::/g)) {
        if (!containerFor(el).shared.has(match[1])) {
          rememberPending(match[1], el);
          waiting = true;
        }
      }
      if (waiting) continue;

      const wired = ((el as PublrElement)._pd ??= new Set());

      if (wired.has(suffix)) {
        continue;
      }

      wired.add(suffix);
      const element = el as PublrElement;
      let scope = element._pc;
      if (!scope) {
        scope = runInScope(scopeForEl(el) ?? containerFor(el).scope, createScope);
        element._pc = scope;
        scope.c.push(() => {
          element._pc = null;
        });
      }
      runInScope(scope, () => {
        onCleanup(() => wired.delete(suffix));
        wire(el, attr);
      });
    }
  }

  ensureLifecycleObserver();
  return root;
};

/** Replace a trusted server-rendered JSX region and retire its previous child islands. */
export const replaceHtml = (element: Element, html: unknown): void => {
  if (html == null) return;
  const next = String(html);
  if (element.innerHTML === next) return;
  // Child setup and teardown may read shared state. Those reads belong to the
  // child, not to the effect that owns this HTML response.
  untrack(() => {
    for (const child of Array.from(element.children)) destroy(child);
    element.innerHTML = next;
    for (const child of Array.from(element.children)) hydrate(child);
  });
};

/** Put data-p-activation="manual" on a demo host before loading assets. */
function activationHeld(el: Element): boolean {
  return !!el.closest('[data-p-activation="manual"]');
}

export function activate(root: Element): void {
  root.removeAttribute("data-p-activation");
  hydrate(root);
}

export function start(): void {
  if (typeof document === "undefined") return;
  ensureLifecycleObserver();
  hydrate(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hydrate(document), { once: true });
  }
}
