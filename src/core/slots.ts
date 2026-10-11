// Compiled expressions: a live expression in a PTSX component is a JavaScript
// function in the generated browser file, and its binding names it by slot:
//
//   data-p-bind="disabled:$e_MergeRow_12"
//   data-p-class="$e_Badge_2(tone: $row.tone, size: &quot;sm&quot;)"
//
// A module with a store of its own returns its functions from the store's
// factory (`expressions`), so `state` and the module's helpers are the
// instance's; any other module registers them here, with the stores its
// imported state names. The function receives a scope: the slot's arguments
// (the props the render knew: the caller's wire, or the value as JSON), each
// imported state by store name, and anything else as the binding's `$` path
// would resolve, a list's row included. It runs inside the directive's
// effect, so what it reads through a reactive store is tracked.

import { evaluateAt } from "./evaluating";
import { containerFor } from "./container";
import { scan } from "./parse";
import { resolveRef, resolveValuePath } from "./resolve";
import { STORE_ATTR } from "./store";
import { ga } from "./util";
import type { PublrElement, StoreRef } from "./types";

export type Expression = (scope: Record<string, unknown>) => unknown;
export type Expressions = Record<string, Expression>;

interface Registered {
  run: Expression;
  /** Local name → store name, for state a module imports from a family. */
  stores: Record<string, string>;
}

const registered = new Map<string, Registered>();

/** Register the functions of a module without a store of its own. */
export const expressions = (stores: Record<string, string>, table: Expressions): void => {
  for (const [name, run] of Object.entries(table)) registered.set(name, { run, stores });
};

const SLOT = /^\$(e_[A-Z][A-Za-z0-9]*_\d+)\s*(?:\(([^]*)\))?\s*$/;

/** Whether a wire names a compiled expression. */
export const isSlot = (spec: string): boolean => SLOT.test(spec.trim());

// The store chain from `el` up, portals followed back to where they were authored:
// [element carrying the store, its store].
function* storesAbove(el: Element): Generator<[Element, StoreRef]> {
  const shared = containerFor(el).shared;
  let node: Element | null = el;

  while (node?.getAttribute) {
    const name = ga(node, STORE_ATTR);
    const store = name ? ((node as PublrElement)._ps ?? shared.get(name)) : null;

    if (store) yield [node, store];

    const portalParent: ParentNode | null | undefined = (node as PublrElement)._pp?.[0];
    node = portalParent instanceof Element ? portalParent : node.parentElement;
  }
}

const find = (el: Element, name: string): Registered | undefined => {
  for (const [, store] of storesAbove(el)) {
    const run = store[5]?.[name];
    if (run) return { run, stores: {} };
  }

  return registered.get(name);
};

const storeNamed = (el: Element, storeName: string): StoreRef | undefined => {
  for (const [node, store] of storesAbove(el)) {
    if (ga(node, STORE_ATTR) === storeName) return store;
  }

  return containerFor(el).shared.get(storeName);
};

// A `$` path read as a binding reads it (`resolve.ts`).
const readPath = (el: Element, path: string): unknown => {
  const [store, rest] = resolveRef(path, el);
  return store ? resolveValuePath(store, rest) : undefined;
};

/**
 * An argument's value as a reader: a slot, a `$` path, JSON, or `undefined` (an
 * optional prop left out). Anything else is
 * read by `fallback` (a wire in the older binding forms a caller may still hand).
 */
const argumentReader = (
  el: Element,
  text: string,
  fallback: (el: Element, spec: string) => () => unknown,
): (() => unknown) => {
  const raw = text.trim();

  if (isSlot(raw)) return slotValue(el, raw, fallback);
  if (raw === "undefined") return () => undefined;
  if (/^\$[\w.:]+$/.test(raw)) return () => readPath(el, raw);

  try {
    const value: unknown = JSON.parse(raw);
    return () => value;
  } catch {
    return fallback(el, raw);
  }
};

const noFallback = (): (() => unknown) => () => undefined;

/** A slot wire as a thunk that runs its function in the binding's scope. */
export const slotValue = (
  el: Element,
  spec: string,
  fallback: (el: Element, spec: string) => () => unknown = noFallback,
): (() => unknown) => {
  const [, name, argumentText] = SLOT.exec(spec.trim())!;
  const readers = new Map<string, () => unknown>();

  for (const part of argumentText ? scan(argumentText, [","]) : []) {
    const [key, value] = scan(part, [":"], 1);
    if (value != null && key.trim()) readers.set(key.trim(), argumentReader(el, value, fallback));
  }

  let entry: Registered | undefined;

  const scope = new Proxy<Record<string, unknown>>(
    {},
    {
      get(_, key) {
        if (typeof key !== "string") return undefined;
        const argument = readers.get(key);
        if (argument) return argument();
        const storeName = entry!.stores[key];
        if (storeName) return storeNamed(el, storeName)?.[0];
        return readPath(el, key);
      },
    },
  );

  return () => {
    entry ??= find(el, name);
    return entry ? evaluateAt(el, () => entry!.run(scope)) : undefined;
  };
};

/** A class binding's value as the class names it stands for. */
export const classNames = (value: unknown): string[] =>
  value == null || value === false
    ? []
    : Array.isArray(value)
      ? value.flatMap(classNames)
      : String(value).split(/\s+/).filter(Boolean);
