import { compiledFactory, isStoreBoundary, structuralRootEnd } from "./core/component-metadata";
// HTML target: companion stores bind attributes and named HTML ranges.
// This entry deliberately has no dependency on the compiled DOM renderer.
export { className } from "./core/class-value";
import { HTML_STORE } from "./core/symbols";
import { createLocalStore } from "./core/store";
import { hydrate, start, destroy } from "./core/lifecycle";
import { bindings, state, type Value } from "./core/graph";
import { withSeed, readSeed } from "./core/transfer";
import {
  createScope,
  disposeScope,
  runInScope,
  onCleanup,
  getActiveScope,
  resumeScope,
  untrack,
} from "./core/reactivity";
import { render, createRegion, inRegion, flushRegion } from "./core/render";
import type { PublrElement, Scope, StoreRef, Refs } from "./core/types";

type Reads = Record<string, () => unknown>;
type Actions = Record<string, (...args: any[]) => unknown>;
export interface Template {
  kind: "template";
  markup: string;
  values: Reads;
  actions: Actions;
  slots: Slot[];
  refs: Refs;
}
interface Slot {
  kind: "slot";
  id: number;
  read: () => Content;
}
interface Choice {
  kind: "choice";
  read: () => unknown;
  yes: () => Content;
  no?: () => Content;
  keyed: boolean;
}
interface List {
  kind: "list";
  read: () => readonly unknown[];
  key: (item: any, index: number) => unknown;
  make: (item: () => any, index: () => number) => Content;
}
interface Child {
  kind: "child";
  make: (props: any) => Content;
  props: any;
}
interface Boundary {
  kind: "loading";
  props: { fallback?: Content; error?: (error: unknown) => Content };
  make: () => Content;
}
type Content =
  | Template
  | Slot
  | Choice
  | List
  | Child
  | Boundary
  | string
  | number
  | boolean
  | null
  | undefined
  | Content[];
interface Range {
  start: Comment;
  end: Comment;
}
interface Instance {
  scope: Scope;
  range: Range;
  store: StoreRef;
  dispose(): void;
}

export const template = (
  markup: string,
  values: Reads = {},
  actions: Actions = {},
  slots: Slot[] = [],
  refs: Refs = {},
): Template => ({ kind: "template", markup, values, actions, slots, refs });
export const slot = (id: number, read: () => Content): Slot => ({ kind: "slot", id, read });
export const when = (
  read: () => unknown,
  yes: () => Content,
  no?: () => Content,
  keyed = false,
): Choice => ({ kind: "choice", read, yes, no, keyed });
export const child = (make: (props: any) => Content, props: any): Child => ({
  kind: "child",
  make,
  props,
});
export const Loading = (props: Boundary["props"], make: () => Content): Boundary => ({
  kind: "loading",
  props,
  make,
});
export const list = (read: List["read"], key: List["key"], make: List["make"]): List => ({
  kind: "list",
  read,
  key,
  make,
});
export const map = list;
export function forEach(
  read: List["read"],
  key: List["key"] | undefined,
  make: List["make"],
  fallback?: () => Content,
  keyed = true,
): Choice {
  return when(
    () => read()?.length > 0,
    () => list(read, key ?? ((item, index) => (keyed ? item : index)), make),
    fallback,
  );
}
export function repeat(
  from: () => number,
  count: () => number,
  make: (index: number) => Content,
): List {
  return list(
    () => {
      const begin = from(),
        size = count();
      if (
        !Number.isSafeInteger(begin) ||
        begin < 0 ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !Number.isSafeInteger(begin + size)
      )
        throw new Error("publr: Repeat requires nonnegative safe integers");
      return Array.from({ length: size }, (_, index) => begin + index);
    },
    (item) => item,
    (item) => make(item()),
  );
}
export function choose(
  matches: Array<{ when: () => unknown; make: () => Content; keyed?: boolean }>,
  fallback?: () => Content,
): Choice {
  let selected = -1,
    previous: unknown,
    identity = {};
  return when(
    () => {
      let index = -1,
        value: unknown;
      for (let i = 0; i < matches.length; i++) {
        value = matches[i].when();
        if (value) {
          index = i;
          break;
        }
      }
      if (index !== selected || (index >= 0 && matches[index].keyed && !Object.is(value, previous)))
        identity = {};
      selected = index;
      previous = value;
      return index < 0 ? false : identity;
    },
    () => matches[selected].make(),
    fallback,
    true,
  );
}
const nodes = (range: Range): ChildNode[] => {
  const result: ChildNode[] = [];
  for (let node = range.start.nextSibling; node && node !== range.end; node = node.nextSibling)
    result.push(node);
  return result;
};
function clear(range: Range) {
  for (const node of nodes(range)) {
    destroy(node);
    node.remove();
  }
}
function bounds(parent: Node, before: Node | null = null): Range {
  const doc = parent.ownerDocument!;
  const start = doc.createComment("p:owned"),
    end = doc.createComment("/p:owned");
  parent.insertBefore(start, before);
  parent.insertBefore(end, before);
  return { start, end };
}
function allComments(roots: Node[]): Comment[] {
  const found: Comment[] = [];
  const visit = (node: Node, top = false) => {
    if (node.nodeType === 8) found.push(node as Comment);
    // Child components bind their own named ranges.
    if (!top && node.nodeType === 1 && isStoreBoundary(node as Element)) return;
    for (const child of node.childNodes) visit(child);
  };
  for (const root of roots) visit(root, true);
  return found;
}
function findRange(roots: Node[], id: number): Range {
  const comments = allComments(roots);
  const start = comments.find((node) => node.data === `p:html:${id}`);
  const end = comments.find((node) => node.data === `/p:html:${id}`);
  if (!start || !end || start.parentNode !== end.parentNode)
    throw new Error(`publr: missing HTML binding range ${id}`);
  return { start, end };
}
function descriptors(reads: Reads) {
  return Object.fromEntries(
    Object.entries(reads).map(([key, read]) => [
      key,
      { enumerable: true, configurable: true, get: read },
    ]),
  );
}
function assignPlan(store: StoreRef, plan: Template) {
  const reads = descriptors(plan.values);
  // Captured state already exposes its public name as a live, writable binding.
  // A template reading that same name must reuse it, not replace its accessor.
  for (const name of Object.keys(reads)) {
    if (Object.getOwnPropertyDescriptor(store[0], name)?.configurable === false) delete reads[name];
  }
  Object.defineProperties(store[0], reads);
  Object.assign(store[1], plan.actions);
  Object.assign((store[4] ??= {}), plan.refs);
}
function wire(roots: Node[], store: StoreRef, scope: Scope) {
  for (const root of roots) {
    if (root.nodeType !== 1) continue;
    const el = root as PublrElement;
    // An adopted child must receive its own store before its directives are wired.
    // A surrounding fragment can encounter this root before the child slot runs.
    if (isStoreBoundary(el) && !el._ps) continue;
    // Runtime scopes can cover any HTML structure; no tag/text cursor is involved.
    if (!el._ps) {
      // A surrounding hydration pass may have reached an adopted row before
      // its deferred region installed the row store. Rebind those directives
      // in their real owner instead of retaining subscriptions to the parent.
      if (el._pc && el._pc !== scope) disposeScope(el._pc);
      el.setAttribute("data-p-store", el.getAttribute("data-p-store") ?? "$html");
      el._ps = store;
      el._pc = scope;
    }
    hydrate(el, { deferMount: !el.isConnected, bindingsOnly: true });
  }
}
function install(plan: Template, roots: Node[], store: StoreRef, scope: Scope, adopt: boolean) {
  assignPlan(store, plan);
  for (const part of plan.slots) attachSlot(findRange(roots, part.id), part, store, adopt);
  wire(roots, store, scope);
}
function insertTemplate(plan: Template, range: Range): Node[] {
  const doc = range.start.ownerDocument;
  const parent = range.end.parentNode as Element;
  let fragment: DocumentFragment;
  if (
    parent.namespaceURI === "http://www.w3.org/2000/svg" &&
    parent.localName !== "foreignObject"
  ) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.innerHTML = plan.markup;
    fragment = doc.createDocumentFragment();
    fragment.append(...svg.childNodes);
  } else {
    const prototype = doc.createElement("template");
    prototype.innerHTML = plan.markup;
    fragment = prototype.content;
  }
  const created = Array.from(fragment.childNodes);
  range.end.parentNode!.insertBefore(fragment, range.end);
  return created;
}
function scopeStore(parent: StoreRef): StoreRef {
  return [
    Object.create(parent[0]),
    Object.create(parent[1]),
    undefined,
    undefined,
    Object.create(parent[4] ?? null),
  ];
}
function mountContent(
  range: Range,
  make: () => Content,
  parent: StoreRef,
  adopt: boolean,
): Instance {
  const scope = createScope(),
    store = scopeStore(parent);
  const instance: Instance = {
    scope,
    range,
    store,
    dispose() {
      disposeScope(scope);
      clear(range);
    },
  };
  try {
    runInScope(scope, () => {
      const values: Record<string, Value<unknown>> = {};
      const content = withSeed(undefined, () => untrack(make), values, store[1]);
      Object.defineProperties(store[0], Object.getOwnPropertyDescriptors(bindings(values)));
      bindContent(range, content, store, scope, adopt);
    });
  } catch (error) {
    disposeScope(scope);
    throw error;
  }
  return instance;
}
function bindContent(
  range: Range,
  content: Content,
  store: StoreRef,
  scope: Scope,
  adopt: boolean,
): void {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    if (content.kind === "template") {
      const existing = adopt ? nodes(range) : insertTemplate(content, range);
      install(content, existing, store, scope, adopt);
    } else if (content.kind === "slot") attachSlot(range, content, store, adopt);
    else if (content.kind === "choice") attachChoice(range, content, store, adopt);
    else if (content.kind === "list") attachList(range, content, store, adopt);
    else if (content.kind === "loading") attachLoading(range, content, store, adopt);
    else if (content.kind === "child") {
      const root = nodes(range).find(
        (node) => node.nodeType === 1 && isStoreBoundary(node as Element),
      ) as PublrElement | undefined;
      const seed = root ? readSeed(root) : undefined;
      const values: Record<string, Value<unknown>> = {};
      const next = withSeed(seed, () => content.make(content.props), values, store[1]);
      Object.defineProperties(store[0], Object.getOwnPropertyDescriptors(bindings(values)));
      if (root) {
        root._ps = store;
        root._pc = scope;
      }
      if (next && typeof next === "object" && "kind" in next && next.kind === "template" && root) {
        // A child's template includes its root. Activate by attributes within that root.
        install(next, [root], store, scope, adopt);
      } else bindContent(range, next, store, scope, adopt);
    }
    return;
  }
  const text = Array.isArray(content)
    ? content
        .map((item) => (item == null || typeof item === "boolean" ? "" : String(item)))
        .join("")
    : content == null || typeof content === "boolean"
      ? ""
      : String(content);
  const existing = nodes(range);
  const current = existing.filter((node) => node.nodeType === 3);
  if (
    current.length === 1 &&
    existing.every((node) => node.nodeType === 3 || node.nodeType === 8)
  ) {
    if (current[0].textContent !== text) current[0].textContent = text;
  } else {
    clear(range);
    range.end.parentNode!.insertBefore(range.end.ownerDocument.createTextNode(text), range.end);
  }
}
function attachSlot(range: Range, part: Slot, store: StoreRef, adopt: boolean) {
  let first = true,
    mounted: Instance | undefined;
  onCleanup(() => {
    retire(mounted);
  });
  render(
    () => {
      const value = part.read();
      if (value && typeof value === "object") {
        mounted ??= prepareContent(range, () => value, store, first && adopt);
        return { instance: mounted };
      }
      return { value };
    },
    (result) => {
      if ("instance" in result) publish(result.instance!, range);
      else {
        retire(mounted);
        mounted = undefined;
        bindContent(range, result.value, store, getActiveScope()!, first);
      }
      first = false;
    },
  );
}
// Prepare new structure in the region's read phase. It remains detached until
// all reads (including newly created async bindings) are ready to commit.
function prepareContent(target: Range, make: () => Content, store: StoreRef, adopt: boolean) {
  let range: Range;
  if (adopt) {
    range = bounds(target.end.parentNode!, target.end);
    target.end.parentNode!.insertBefore(range.start, target.start.nextSibling);
  } else range = bounds(target.end.ownerDocument.createDocumentFragment());
  return mountContent(range, make, store, adopt);
}
function retire(instance: Instance | undefined) {
  if (!instance) return;
  instance.dispose();
  instance.range.start.remove();
  instance.range.end.remove();
}
function publish(instance: Instance, target: Range) {
  if (instance.range.end.parentNode === target.end.parentNode) return;
  const content = nodes(instance.range);
  for (const node of [instance.range.start, ...content, instance.range.end])
    target.end.parentNode!.insertBefore(node, target.end);
  if (target.end.isConnected)
    for (const node of content) if (node.nodeType === 1) hydrate(node as Element);
}
function attachChoice(range: Range, choice: Choice, store: StoreRef, adopt: boolean) {
  let selected: unknown = Symbol(),
    candidateKey: unknown = Symbol();
  let mounted: Instance | undefined,
    candidate: Instance | undefined,
    first = true;
  onCleanup(() => {
    retire(candidate);
    retire(mounted);
  });
  render(
    () => {
      const value = choice.read();
      const next = choice.keyed && value ? value : !!value;
      if (Object.is(next, selected)) {
        retire(candidate);
        candidate = undefined;
        candidateKey = Symbol();
        if (mounted?.scope.paused) resumeScope(mounted.scope);
        return next;
      }
      if (mounted) mounted.scope.paused = true;
      if (!Object.is(next, candidateKey)) {
        retire(candidate);
        candidate = prepareContent(
          range,
          next ? choice.yes : (choice.no ?? (() => null)),
          store,
          first && adopt,
        );
        candidateKey = next;
      }
      return next;
    },
    (next) => {
      if (Object.is(next, selected)) return;
      retire(mounted);
      mounted = candidate;
      candidate = undefined;
      candidateKey = Symbol();
      if (mounted) publish(mounted, range);
      selected = next;
      first = false;
    },
  );
}
function existingRows(range: Range): Map<string, Range> {
  const result = new Map<string, Range>();
  let open: Comment | undefined,
    key = "";
  for (const node of nodes(range)) {
    if (node.nodeType !== 8) continue;
    const comment = node as Comment;
    if (comment.data.startsWith("p:row:")) {
      open = comment;
      key = comment.data.slice(6);
    } else if (open && comment.data.startsWith("/p:row:")) {
      result.set(key, { start: open, end: comment });
      open = undefined;
    }
  }
  return result;
}
function attachList(range: Range, definition: List, store: StoreRef, adopt: boolean) {
  type Row = {
    item: ReturnType<typeof state<any>>;
    index: ReturnType<typeof state<number>>;
    instance: Instance;
  };
  let rows = new Map<unknown, Row>(),
    prepared = new Map<unknown, Row>();
  const serverRows = adopt ? existingRows(range) : new Map<string, Range>();
  let first = true;
  onCleanup(() => {
    for (const row of new Set([...rows.values(), ...prepared.values()])) retire(row.instance);
  });
  render(
    () => {
      const items = Array.from(definition.read() ?? []);
      const keys = items.map(definition.key),
        seen = new Set();
      for (const key of keys) {
        if (
          !(
            key === null ||
            typeof key === "boolean" ||
            typeof key === "string" ||
            (typeof key === "number" && Number.isFinite(key) && !Object.is(key, -0))
          ) ||
          seen.has(key)
        )
          throw new Error("publr: HTML list keys must be unique JSON scalars");
        seen.add(key);
      }
      const next = new Map<unknown, Row>();
      for (let i = 0; i < items.length; i++) {
        const key = keys[i];
        let row = prepared.get(key) ?? rows.get(key);
        if (row) {
          if (row.instance.scope.paused) resumeScope(row.instance.scope);
          row.item.write(items[i]);
          row.index.write(i);
        } else {
          const item = state(items[i]),
            index = state(i);
          const existing = first
            ? serverRows.get(encodeURIComponent(JSON.stringify(key)))
            : undefined;
          const target = existing ?? bounds(range.end.ownerDocument.createDocumentFragment());
          const instance = mountContent(
            target,
            () =>
              definition.make(
                () => item.read(),
                () => index.read(),
              ),
            store,
            !!existing,
          );
          row = { item, index, instance };
        }
        next.set(key, row);
      }
      for (const [key, row] of prepared) if (!next.has(key) && !rows.has(key)) retire(row.instance);
      for (const [key, row] of rows) if (!next.has(key)) row.instance.scope.paused = true;
      prepared = next;
      return next;
    },
    (next) => {
      if (first && !serverRows.size) clear(range);
      for (const [key, row] of rows) if (!next.has(key)) retire(row.instance);
      const parent = range.end.parentNode!;
      const active = range.end.ownerDocument.activeElement as HTMLElement | null;
      let before: Node | null = range.start.nextSibling;
      for (const row of next.values()) {
        for (const node of [
          row.instance.range.start,
          ...nodes(row.instance.range),
          row.instance.range.end,
        ]) {
          if (node === before) before = before.nextSibling;
          else if ("moveBefore" in parent && node.isConnected && parent.isConnected)
            (parent as Element & { moveBefore(node: Node, before: Node | null): void }).moveBefore(
              node,
              before ?? range.end,
            );
          else parent.insertBefore(node, before ?? range.end);
        }
      }
      if (active?.isConnected && range.end.ownerDocument.activeElement !== active)
        active.focus({ preventScroll: true });
      if (range.end.isConnected)
        for (const row of next.values())
          for (const node of nodes(row.instance.range))
            if (node.nodeType === 1) hydrate(node as Element);
      rows = next;
      first = false;
    },
  );
}
function attachLoading(range: Range, boundary: Boundary, store: StoreRef, adopt: boolean) {
  const region = createRegion();
  let fallback: Instance | undefined, mounted: Instance | undefined;
  let committed = adopt,
    fallbackKey: unknown = Symbol(),
    fallbackPending = false;
  region.status = (error, pending, failed) => {
    if (pending || failed) {
      if (
        !committed &&
        (!fallback || pending !== fallbackPending || !Object.is(error, fallbackKey))
      ) {
        retire(fallback);
        fallbackKey = error;
        fallbackPending = pending;
        fallback = inRegion(undefined, () =>
          prepareContent(
            range,
            () => {
              if (failed && !pending) {
                if (boundary.props.error) return boundary.props.error(error);
                throw error;
              }
              return boundary.props.fallback;
            },
            store,
            false,
          ),
        );
        publish(fallback, range);
      }
      return;
    }
    retire(fallback);
    fallback = undefined;
    if (mounted) publish(mounted, range);
    committed = true;
  };
  mounted = inRegion(region, () => prepareContent(range, boundary.make, store, adopt));
  region.building = false;
  flushRegion(region);
  onCleanup(() => {
    region.disposed = true;
    retire(fallback);
    retire(mounted);
  });
}
export function register<P>(name: string, make: (props: P) => Content): void {
  createLocalStore(
    name,
    compiledFactory(() => {
      const target = { [HTML_STORE]: true },
        actions: Actions = {},
        refs: Refs = {};
      return {
        state: target,
        actions,
        refs,
        init: ({ el }: { el: Element }) => {
          const seed = readSeed<P>(el);
          const values: Record<string, Value<unknown>> = {};
          const plan = withSeed(seed, () => make(seed?.props ?? ({} as P)), values, actions);
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(bindings(values)));
          const store = (el as PublrElement)._ps!;
          if (plan && typeof plan === "object" && "kind" in plan && plan.kind === "template") {
            assignPlan(store, plan);
            for (const part of plan.slots)
              attachSlot(findRange(Array.from(el.childNodes), part.id), part, store, true);
          } else {
            const end = structuralRootEnd(el);
            if (!end) throw new Error("publr: HTML structural root is missing its boundary");
            const range = {
              start: el.ownerDocument.createComment("p:owned"),
              end: el.ownerDocument.createComment("/p:owned"),
            };
            el.parentNode!.insertBefore(range.start, el.nextSibling);
            end.parentNode!.insertBefore(range.end, end);
            bindContent(range, plan, store, getActiveScope()!, true);
          }
        },
      };
    }),
  );
}
start();
