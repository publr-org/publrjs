// Ref resolution: bind an unqualified wire ref (`$x`, bare path, action name)
// through the DOM's store chain, or a qualified `store::path` directly to a
// shared store — plus the predicate-binding pipeline every conditional
// directive goes through. Stores travel as StoreRef tuples
// ([state, actions, …] — see types.ts).

import { containerFor } from "./container";
import { HTML_STORE } from "./symbols";
import { effect } from "./reactivity";
import { render } from "./render";
import { STORE_ATTR } from "./store";
import { evaluatePredicate, parsePredicate, resolvePath, stripStatePrefix } from "./parse";
import { ga } from "./util";
import type { PublrElement, StoreRef } from "./types";

/** The bag (state or actions) whose top-level key owns `path`, or null. */
const bagFor = ([state, actions]: StoreRef, path: string): object | null => {
  const top = path.split(".")[0];

  return state && top in state ? state : actions && top in actions ? actions : null;
};

/**
 * Walk the store chain upward from `el` (following portal back-links so
 * portaled content resolves through its AUTHORED position — same law as React
 * portals) and return [owning store, bare path].
 *
 * A qualified `store::path` ref bypasses that chain and addresses a shared
 * store explicitly. The optional `$` state sigil applies to the whole ref:
 * `$cms::permissions.canEdit` and `cms::permissions.canEdit` are equivalent.
 * Local factories are deliberately excluded because one factory name may
 * identify many island instances; local refs continue to resolve by ancestry.
 *
 * Unqualified refs fall back to a shared store named by the whole ref, then to
 * the innermost store.
 */
export const resolveRef = (ref: string, el: Element): [store: StoreRef | null, rest: string] => {
  // `$` is the state-ref sigil (identical in ZSX sources and the wire);
  // strip it and resolve the bare path through the scope chain. Bare refs
  // (loop vars bound by @for, action names) carry no sigil.
  const sharedStores = containerFor(el).shared;
  const bare = stripStatePrefix(ref.trim());
  const qualifier = bare.indexOf("::");

  if (qualifier > 0) {
    const storeName = bare.slice(0, qualifier);
    const path = bare.slice(qualifier + 2);

    return path ? [sharedStores.get(storeName) ?? null, path] : [null, path];
  }

  let first: StoreRef | null = null;
  let node: Element | null = el;

  while (node?.getAttribute) {
    const name = ga(node, STORE_ATTR);

    if (name) {
      const store = (node as PublrElement)._ps ?? sharedStores.get(name);

      if (store) {
        first ??= store;

        // bagFor probes the top segment; the extra `in actions` check also
        // matches action keys that literally contain dots.
        if (bagFor(store, bare) || (store[1] && bare in store[1])) {
          return [store, bare];
        }
      }
    }

    // Portaled content: follow the authored-parent back-link.
    const portalParent: ParentNode | null | undefined = (node as PublrElement)._pp?.[0];
    node = portalParent instanceof Element ? portalParent : node.parentElement;
  }

  if (!bare.includes(".")) {
    const store = sharedStores.get(bare);

    if (store) {
      return [store, bare];
    }
  }

  return [first, bare];
};

export const resolveValuePath = (store: StoreRef, rawPath: string): any => {
  const path = stripStatePrefix(rawPath);
  const bag = bagFor(store, path);

  return bag ? resolvePath(bag, path) : undefined;
};

/** Resolve `@name` against the nearest authored `data-name` value. */
export const resolveElementValue = (el: Element, reference: string): string | undefined => {
  if (!reference.startsWith("@")) return undefined;
  const key = reference.slice(1);
  let node: Element | null = el;

  while (node) {
    const value = (node as HTMLElement).dataset?.[key];
    if (value !== undefined) return value;
    const portalParent: ParentNode | null | undefined = (node as PublrElement)._pp?.[0];
    node = portalParent instanceof Element ? portalParent : node.parentElement;
  }

  return undefined;
};

export const bindRef = (
  el: Element,
  ref: string,
  callback: (store: StoreRef, rest: string) => void,
): void => {
  const [store, rest] = resolveRef(ref, el);

  if (store) {
    effect(() => callback(store, rest));
  }
};

/**
 * The shared pipeline behind -show / -class / -bind / -if and every
 * value-producing group: parse `['not'] ref [op literal]`, resolve the ref
 * against its owning store, and re-run `apply` with the (possibly negated)
 * value on every change. Plain refs pass their RAW value through (predicates
 * and negation produce booleans).
 */
export const bindPredicate = (
  el: Element,
  spec: string,
  apply: (value: any) => void,
  project: (value: unknown) => unknown = (value) => value,
): void => {
  const [ref, negate, op, literal] = parsePredicate(spec);

  const [store, rest] = resolveRef(ref, el);
  if (!store) return;
  if (!store[0][HTML_STORE]) {
    effect(() => {
      const raw = resolveValuePath(store, rest);
      const compared = (literal && resolveElementValue(el, literal)) ?? literal;
      const value = op ? evaluatePredicate(raw, op, compared!) : raw;
      apply(project(negate ? !value : value));
    });
    return;
  }
  render(() => {
    const raw = resolveValuePath(store, rest);
    const compared = (literal && resolveElementValue(el, literal)) ?? literal;
    const value = op ? evaluatePredicate(raw, op, compared!) : raw;
    return project(negate ? !value : value);
  }, apply);
};
