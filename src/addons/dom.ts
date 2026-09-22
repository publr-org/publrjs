import { setDirectiveValue } from "../core/directive-value";
import { compiledFactory, structuralRootEnd } from "../core/component-metadata";
import { className } from "../core/class-value";
import { mergeClasses } from "./class-merge";
import { unwrap } from "../core/reactive";
import { containerFor } from "../core/container";
import { withSeed, readSeed, type Seed } from "../core/transfer";
// Small compiler target: specialized writes, shared ownership and reconciliation.
import {
  createScope,
  pure,
  disposeScope,
  getActiveScope,
  onCleanup,
  runInScope,
  resumeScope,
  untrack,
  postEffect,
} from "../core/reactivity";
import { wirePortal } from "../core/portal";
import { wirePosition } from "../core/position";
import { wireFocus } from "../core/focus";
import { wireRef } from "../core/ref";
import { createRegion, flushRegion, inRegion, render } from "../core/render";
import { state, bindings, type Value } from "../core/graph";
import type { Scope, PublrElement } from "../core/types";

export type Component<P = Record<string, unknown>> = (props: P) => Node;
const hydratedRoots = new WeakMap<
  Element,
  {
    make: Component<any>;
    dispose: () => void;
    values: Record<string, Value<unknown>>;
    actions: Record<string, (...args: any[]) => any>;
  }
>();
interface Cursor {
  parent: Node;
  next: ChildNode | null;
  end?: ChildNode;
}
let cursor: Cursor | undefined;
let documentOwner: Document | undefined;
const doc = () => documentOwner ?? document;
const display = (value: unknown): string =>
  value == null || typeof value === "boolean" ? "" : String(value);
const consume = (): ChildNode => {
  const node = cursor?.next;
  if (!node || node === cursor?.end) throw new Error("publr-dom: hydration structure mismatch");
  cursor!.next = node.nextSibling;
  return node;
};

export function element(
  tag: string,
  setup: (element: Element) => void,
  namespace?: string,
): Element {
  const parent = cursor;
  const node = parent
    ? (consume() as Element)
    : namespace
      ? doc().createElementNS(namespace, tag)
      : doc().createElement(tag);
  if (node.nodeType !== 1 || node.localName !== tag)
    throw new Error(`publr-dom: expected <${tag}> during hydration`);
  if (parent) cursor = { parent: node, next: node.firstChild };
  try {
    setup(node);
    if (cursor?.next) throw new Error(`publr-dom: unclaimed children in <${tag}>`);
  } finally {
    cursor = parent;
  }
  return node;
}
export function append(parent: Node, child: Node): void {
  if (child.parentNode !== parent) parent.appendChild(child);
}
export function literal(value: unknown): Text {
  const valueText = display(value);
  const empty =
    cursor &&
    valueText === "" &&
    (!cursor.next || cursor.next === cursor.end || cursor.next.nodeType !== 3);
  const node = cursor && !empty ? (consume() as Text) : doc().createTextNode(valueText);
  if (empty && cursor) cursor.parent.insertBefore(node, cursor.next);
  if (node.nodeType !== 3 || node.data !== valueText)
    throw new Error("publr-dom: text hydration mismatch");
  return node;
}
export function text(read: () => unknown): Node {
  // The marker separates adjacent HTML text nodes and gives empty values identity.
  const marker = cursor ? consume() : doc().createComment("p:text");
  if (marker.nodeType !== 8 || marker.textContent !== "p:text")
    throw new Error("publr-dom: missing text marker");
  let node: Text;
  if (cursor) {
    node = cursor.next?.nodeType === 3 ? (consume() as Text) : doc().createTextNode("");
    if (!node.parentNode) marker.parentNode!.insertBefore(node, cursor.next);
  } else node = doc().createTextNode("");
  render(
    () => display(read()),
    (value) => {
      if (node.data !== value) node.data = value;
    },
  );
  if (cursor) return marker;
  const fragment = doc().createDocumentFragment();
  fragment.append(marker, node);
  return fragment;
}
function defaultControl(node: Element, name: string, value: unknown): void {
  if (name === "value") node.setAttribute(name, String(value ?? ""));
  else if (name === "checked") node.toggleAttribute(name, !!value);
}
export function attribute(node: Element, name: string, value: unknown): void {
  defaultControl(node, name, value);
  writeAttribute(node, name, value);
}
function writeAttribute(node: Element, name: string, value: unknown): void {
  if (setDirectiveValue(node, name, value)) return;
  if (name === "value" || name === "checked" || name === "indeterminate") {
    const target = node as unknown as Record<string, unknown>;
    const next = name === "value" ? (value ?? "") : !!value;
    if (target[name] !== next) target[name] = next;
  } else if (name.startsWith("aria-") && typeof value === "boolean")
    node.setAttribute(name, String(value));
  else if (value == null || value === false) node.removeAttribute(name);
  else node.setAttribute(name, value === true ? "" : String(value));
}
// The element whose attribute is being evaluated, so `dataset()` can read that
// element's own `data-<name>`, walking up the way the wire does.
let evaluating: Element | null = null;
const evaluate =
  <T>(node: Element, read: () => T) =>
  (): T => {
    const previous = evaluating;
    evaluating = node;
    try {
      return read();
    } finally {
      evaluating = previous;
    }
  };
/** `Publr.dataset(name)` inside an attribute expression: the nearest `data-<name>`. */
export function dataset(name: string): string | undefined {
  // A first render evaluates an element before its parent adopts it, so the
  // ancestor that carries the attribute is not reachable yet; the binding
  // re-reads once the tree is placed.
  if (evaluating && !evaluating.parentNode && !placed.has(evaluating)) {
    attached.read();
    placing.add(evaluating);
    if (placing.size === 1)
      queueMicrotask(() => {
        for (const node of placing) placed.add(node);
        placing.clear();
        attached.write(untrack(() => attached.read()) + 1);
      });
  }
  for (let node = evaluating; node; node = node.parentElement) {
    const value = (node as HTMLElement).dataset?.[name];
    if (value !== undefined) return value;
  }
  return undefined;
}
const attached = state(0);
const placing = new Set<Element>();
const placed = new WeakSet<Element>();
// Elements whose visibility a binding owns. A `hidden={…}` binding and the show
// wrapper both toggle the `hidden` class, as the wire's data-p-show does, so a
// component's static `hidden` class is its closed state; a class re-render must
// not restore that class while the element is shown.
const visibility = new WeakMap<Element, boolean>();
function setVisible(node: Element, shown: boolean): void {
  visibility.set(node, shown);
  node.classList.toggle("hidden", !shown);
}
export function attr(node: Element, name: string, read: () => unknown): void {
  if (name === "hidden") {
    render(evaluate(node, read), (value) => {
      node.toggleAttribute("hidden", !!value);
      setVisible(node, !value);
    });
    return;
  }
  let initial = true;
  render(evaluate(node, read), (value) => {
    if (initial) defaultControl(node, name, value);
    writeAttribute(node, name, value);
    initial = false;
  });
}
/** Handlers run in the scope that wired them, so what they reach (a family's
 * store, a query cache) is the one their element belongs to. */
export function event(node: EventTarget, name: string, handler: EventListener): void {
  const owner = getActiveScope();
  const listener = (raw: Event) =>
    runInScope(owner, () =>
      typeof handler === "function"
        ? handler(raw)
        : (handler as EventListenerObject).handleEvent(raw),
    );
  node.addEventListener(name, listener);
  onCleanup(() => node.removeEventListener(name, listener));
}
export function reference(node: Element, ref: (element: Element | null) => void): void {
  ref(node);
  onCleanup(() => ref(null));
}
/** The class stack is merged the way the server merges it: a later utility
 * replaces an earlier one it conflicts with. */
export function classes(node: Element, read: () => unknown): void {
  const reading = evaluate(node, read);
  render(
    () => mergeClasses(className(reading())),
    (value) => {
      attribute(node, "class", value);
      const shown = visibility.get(node);
      if (shown !== undefined) node.classList.toggle("hidden", !shown);
    },
  );
}
export function styles(node: Element, read: () => unknown): void {
  const reading = evaluate(node, read);
  render(
    () => {
      const value = reading();
      if (typeof value === "string") return value;
      return Object.entries((value ?? {}) as Record<string, unknown>)
        .map(([name, val]) => {
          const resolved = typeof val === "function" ? val() : val;
          return resolved == null
            ? ""
            : `${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${String(resolved)}`;
        })
        .filter(Boolean)
        .join(";");
    },
    (value) => attribute(node, "style", value),
  );
}
export function component<P>(make: Component<P>, props: P): Node {
  if (cursor?.next?.nodeType === 1 && (cursor.next as Element).hasAttribute("data-p-store")) {
    const root = consume() as Element;
    const end = structuralRootEnd(root);
    if (end && cursor) cursor.next = end.nextSibling;
    const dispose = hydrate(root, make, props);
    onCleanup(dispose);
    return root;
  }
  // Every component instance owns a scope, so a family root can hang its
  // instance there and the parts below find it through the chain.
  return runInScope(createScope(), () => untrack(() => make(props)));
}

/**
 * A family root's module-level store, refs, helpers and actions, made once per
 * root instance. The compiler wraps those declarations in `make`, the root
 * component calls `create()`, and the forwarded exports the parts import reach
 * the instance of the root they render under through the owner scope. A part
 * rendered without a root shares one orphan instance, as module state would.
 */
export function family<T extends object>(name: string, make: () => T) {
  const instances = new WeakMap<Scope, T>();
  let orphan: T | undefined;
  const current = (): T => {
    for (let scope = getActiveScope(); scope; scope = scope.parent ?? null) {
      const instance = instances.get(scope);
      if (instance) return instance;
    }
    orphan ??= runInScope(null, make);
    return orphan;
  };
  const member = (key: keyof T): object => current()[key] as object;
  return {
    name,
    current,
    create(): T {
      const scope = getActiveScope();
      const instance = make();
      if (scope) instances.set(scope, instance);
      return instance;
    },
    /** The root component: its instance exists before its props are read, so
     * the parts a children getter builds already find it. */
    root<P>(make: Component<P>): Component<P> {
      return (props) => {
        this.create();
        return make(props);
      };
    },
    /** A stand-in for a store or ref: every access reaches the current instance. */
    field<K extends keyof T>(key: K): T[K] {
      const target = (() => {}) as unknown as object;
      return new Proxy(target, {
        get: (_, property) => Reflect.get(member(key), property),
        set: (_, property, value) => Reflect.set(member(key), property, value),
        has: (_, property) => Reflect.has(member(key), property),
        deleteProperty: (_, property) => Reflect.deleteProperty(member(key), property),
        ownKeys: () => Reflect.ownKeys(member(key)),
        getOwnPropertyDescriptor: (_, property) => {
          const descriptor = Reflect.getOwnPropertyDescriptor(member(key), property);
          return descriptor && { ...descriptor, configurable: true };
        },
        apply: (_, self, args) =>
          Reflect.apply(member(key) as (...args: unknown[]) => unknown, self, args),
      }) as T[K];
    },
    /** A stand-in for an action: the call reaches the current instance. */
    action<K extends keyof T>(key: K): T[K] {
      return ((...args: unknown[]) =>
        (member(key) as (...args: unknown[]) => unknown)(...args)) as T[K];
    },
  };
}
export function show<T extends Element>(node: T, read: () => unknown): T {
  render(evaluate(node, read), (value) => setVisible(node, !!value));
  return node;
}

interface Range {
  start: Comment;
  end: Comment;
  output: Node;
  adopted: boolean;
}
function range(name: string): Range {
  if (cursor) {
    const start = consume() as Comment;
    if (start.nodeType !== 8 || start.data !== `p:${name}`)
      throw new Error(`publr-dom: missing ${name} marker`);
    let end = cursor.next;
    let depth = 0;
    while (end) {
      if (end.nodeType === 8 && end.textContent === `p:${name}`) depth++;
      if (end.nodeType === 8 && end.textContent === `/p:${name}`) {
        if (!depth) break;
        depth--;
      }
      end = end.nextSibling;
    }
    if (!end) throw new Error(`publr-dom: missing ${name} closing marker`);
    cursor.next = end.nextSibling;
    return { start, end: end as Comment, output: start, adopted: true };
  }
  const output = doc().createDocumentFragment();
  const start = doc().createComment(`p:${name}`);
  const end = doc().createComment(`/p:${name}`);
  output.append(start, end);
  return { start, end, output, adopted: false };
}
interface Mounted {
  scope: Scope;
  nodes: ChildNode[];
}
function build(make: () => Node, target: Range, adopt = false): Mounted {
  const scope = createScope();
  const previous = cursor;
  const previousDocument = documentOwner;
  documentOwner = target.end.ownerDocument;
  if (adopt)
    cursor = { parent: target.end.parentNode!, next: target.start.nextSibling, end: target.end };
  else cursor = undefined;
  try {
    const node = runInScope(scope, () => untrack(make));
    const nodes = adopt
      ? between(target)
      : node.nodeType === 11
        ? [...node.childNodes]
        : [node as ChildNode];
    if (adopt && cursor?.next !== target.end)
      throw new Error("publr-dom: unclaimed region content");
    if (!adopt) target.end.parentNode!.insertBefore(node, target.end);
    return { scope, nodes };
  } catch (error) {
    disposeScope(scope);
    throw error;
  } finally {
    cursor = previous;
    documentOwner = previousDocument;
  }
}
function between(target: Range): ChildNode[] {
  const nodes: ChildNode[] = [];
  for (let node = target.start.nextSibling; node && node !== target.end; node = node.nextSibling)
    nodes.push(node);
  return nodes;
}
function retire(mounted: Mounted | undefined): void {
  if (!mounted) return;
  const first = mounted.nodes[0];
  const last = mounted.nodes.at(-1);
  const nodes: ChildNode[] = [];
  if (first?.parentNode && first.parentNode === last?.parentNode) {
    for (let node: ChildNode | null = first; node; node = node.nextSibling) {
      nodes.push(node);
      if (node === last) break;
    }
  } else nodes.push(...mounted.nodes);
  disposeScope(mounted.scope);
  // Portal cleanup can restore nodes into this span while owners are retired.
  if (first?.parentNode && first.parentNode === last?.parentNode) {
    for (let node: ChildNode | null = first; node; node = node.nextSibling) {
      if (!nodes.includes(node)) nodes.push(node);
      if (node === last) break;
    }
  }
  for (const node of nodes) node.remove();
}
function prepare(make: () => Node, target: Range): Mounted {
  const scope = createScope();
  const previous = cursor;
  const previousDocument = documentOwner;
  cursor = undefined;
  documentOwner = target.end.ownerDocument;
  try {
    const node = runInScope(scope, () => untrack(make));
    return { scope, nodes: node.nodeType === 11 ? [...node.childNodes] : [node as ChildNode] };
  } catch (error) {
    disposeScope(scope);
    throw error;
  } finally {
    cursor = previous;
    documentOwner = previousDocument;
  }
}
export function when(read: () => unknown, yes: () => Node, no?: () => Node, keyed = false): Node {
  const target = range("when");
  let mounted: Mounted | undefined;
  let candidate: Mounted | undefined;
  let candidateBranch: unknown;
  let branch: unknown;
  let initial = true;
  render(
    () => {
      const value = read();
      const next = keyed && value ? value : !!value;
      if (Object.is(next, branch)) {
        retire(candidate);
        candidate = undefined;
        candidateBranch = undefined;
        if (mounted?.scope.paused) resumeScope(mounted.scope);
        return next;
      }
      if (mounted) mounted.scope.paused = true;
      if (!Object.is(candidateBranch, next)) {
        retire(candidate);
        candidate = undefined;
        const make = next ? yes : no;
        if (make)
          candidate = initial && target.adopted ? build(make, target, true) : prepare(make, target);
        candidateBranch = next;
      }
      return next;
    },
    (next) => {
      if (Object.is(next, branch)) return;
      retire(mounted);
      mounted = candidate;
      candidate = undefined;
      candidateBranch = undefined;
      if (mounted)
        for (const node of mounted.nodes)
          if (node.parentNode !== target.end.parentNode)
            target.end.parentNode!.insertBefore(node, target.end);
      branch = next;
      initial = false;
    },
  );
  onCleanup(() => {
    retire(candidate);
    retire(mounted);
  });
  return target.output;
}

function rowKey(value: unknown): string {
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "boolean" &&
    !(typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0))
  )
    throw new Error("publr-dom: list keys must be JSON scalars");
  return encodeURIComponent(JSON.stringify(value));
}

interface Row extends Mounted {
  range: Range;
  item: ReturnType<typeof state<any>>;
  index: ReturnType<typeof state<number>>;
  value: unknown;
}
/** Plain data that reads the same. A region re-reads its list on every flush,
 * so a source that builds fresh rows per read must not rewrite every row. */
function equivalent(a: unknown, b: unknown, depth = 0): boolean {
  a = unwrap(a);
  b = unwrap(b);
  if (Object.is(a, b)) return true;
  if (depth > 8 || typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!Array.isArray(a) && (!plain(a) || !plain(b))) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) => Object.hasOwn(right, key) && equivalent(left[key], right[key], depth + 1),
  );
}
const plain = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
export function list<T>(
  read: () => ArrayLike<T> | null | undefined,
  key: (item: T, index: number) => unknown,
  make: (item: () => T, index: () => number) => Node,
): Node {
  const target = range("list");
  let rows = new Map<unknown, Row>();
  let prepared = new Map<unknown, Row>();
  let initial = true;
  render(
    () => {
      const values = Array.from(read() ?? []);
      const keys = values.map(key);
      keys.forEach(rowKey);
      if (new Set(keys).size !== keys.length) throw new Error("publr-dom: duplicate list key");
      const next = new Map<unknown, Row>();
      const previous = cursor;
      if (initial && target.adopted)
        cursor = {
          parent: target.end.parentNode!,
          next: target.start.nextSibling,
          end: target.end,
        };
      else cursor = undefined;
      try {
        for (let index = 0; index < values.length; index++) {
          const id = keys[index];
          let row = prepared.get(id) ?? rows.get(id);
          if (row) {
            if (row.scope.paused) resumeScope(row.scope);
            if (!equivalent(row.value, values[index])) {
              row.value = values[index];
              row.item.write(values[index]);
            }
            row.index.write(index);
          } else {
            const rowRange = range(`row:${rowKey(id)}`);
            const item = state(values[index]);
            const position = state(index);
            row = {
              ...build(
                () =>
                  make(
                    () => item.read(),
                    () => position.read(),
                  ),
                rowRange,
                rowRange.adopted,
              ),
              range: rowRange,
              item,
              index: position,
              value: values[index],
            };
          }
          next.set(id, row);
        }
        if (initial && target.adopted && cursor?.next !== target.end)
          throw new Error("publr-dom: unclaimed keyed rows");
      } finally {
        cursor = previous;
      }
      for (const [id, row] of prepared) if (!next.has(id) && !rows.has(id)) retire(row);
      for (const [id, row] of rows) if (!next.has(id)) row.scope.paused = true;
      prepared = next;
      return next;
    },
    (next) => {
      for (const [id, row] of rows)
        if (!next.has(id)) {
          retire(row);
          row.range.start.remove();
          row.range.end.remove();
        }
      const parent = target.end.parentNode!;
      const active = target.end.ownerDocument.activeElement as HTMLElement | null;
      let position = target.start.nextSibling;
      for (const row of next.values()) {
        const nodes = [row.range.start, ...between(row.range), row.range.end];
        for (const node of nodes) {
          if (node === position) position = position.nextSibling;
          else if ("moveBefore" in parent && node.isConnected && parent.isConnected)
            (parent as Element & { moveBefore(node: Node, before: Node | null): void }).moveBefore(
              node,
              position ?? target.end,
            );
          else parent.insertBefore(node, position ?? target.end);
        }
      }
      if (active?.isConnected && target.end.ownerDocument.activeElement !== active)
        active.focus({ preventScroll: true });
      rows = next;
      initial = false;
    },
  );
  onCleanup(() => {
    for (const row of new Set([...rows.values(), ...prepared.values()])) disposeScope(row.scope);
  });
  return target.output;
}

export function Loading(props: {
  children: Node | Node[] | (() => Node | Node[]);
  fallback: Node | (() => Node);
  error?: (error: unknown) => Node;
}): Node {
  const children = () => {
    const authored = props.children;
    const value = typeof authored === "function" ? authored() : authored;
    if (!Array.isArray(value)) return value;
    const output = doc().createDocumentFragment();
    if (!cursor) output.append(...value);
    return output;
  };
  const fallbackContent = () => {
    const value = props.fallback;
    return typeof value === "function" ? value() : value;
  };
  const target = range("loading");
  const region = createRegion();
  let fallback: Mounted | undefined;
  let content: Mounted | undefined;
  let committed = false;
  let fallbackState: unknown = Symbol();
  let fallbackPending = false;
  const staging = doc().createDocumentFragment();
  region.status = (error, pending, failed) => {
    if (pending || failed) {
      if (!committed) {
        const next = pending ? undefined : error;
        if (!fallback || pending !== fallbackPending || !Object.is(next, fallbackState)) {
          fallbackPending = pending;
          retire(fallback);
          fallbackState = next;
          fallback = inRegion(undefined, () =>
            build(() => {
              if (failed && !pending) {
                if (props.error) return props.error(error);
                throw error;
              }
              return fallbackContent();
            }, target),
          );
        }
      }
      return;
    }
    retire(fallback);
    fallback = undefined;
    if (staging.childNodes.length) target.end.parentNode!.insertBefore(staging, target.end);
    if (content) content.nodes = between(target);
    committed = true;
  };
  content = inRegion(region, () => build(children, target, target.adopted));
  if (!target.adopted) for (const node of content.nodes) staging.appendChild(node);
  region.building = false;
  flushRegion(region);
  onCleanup(() => {
    region.disposed = true;
    retire(fallback);
    retire(content);
  });
  return target.output;
}

export function mount<P>(
  host: Element,
  make: Component<P>,
  props?: P,
  options: {
    hydrate?: boolean;
    initial?: Seed;
    values?: Record<string, Value<unknown>>;
    actions?: Record<string, (...args: any[]) => any>;
  } = {},
): () => void {
  const scope = runInScope(containerFor(host).scope, createScope);
  const owner = host as PublrElement;
  const parentOwner = owner._pc;
  if (parentOwner) parentOwner.c.push(() => disposeScope(scope));
  else owner._pc = scope;
  const previousDoc = documentOwner;
  const previousCursor = cursor;
  documentOwner = host.ownerDocument;
  const rootEnd = options.hydrate ? structuralRootEnd(host) : undefined;
  cursor = options.hydrate
    ? {
        parent: host.parentNode ?? host.ownerDocument,
        next: rootEnd ? host.nextSibling : host,
        end: rootEnd ?? host.nextSibling ?? undefined,
      }
    : undefined;
  let nodes: ChildNode[] = [];
  try {
    runInScope(scope, () => {
      if (options.hydrate) onCleanup(() => hydratedRoots.delete(host));
      const node = withSeed(
        options.initial,
        () => untrack(() => make(props as P)),
        options.values,
        options.actions,
      );
      if (cursor?.next && cursor.next !== cursor.end)
        throw new Error("publr-dom: unclaimed root content");
      nodes = options.hydrate
        ? rootEnd
          ? [host, ...rootNodes(host, rootEnd), rootEnd]
          : [host]
        : node.nodeType === 11
          ? [...node.childNodes]
          : [node as ChildNode];
      if (!options.hydrate) host.appendChild(node);
    });
  } catch (error) {
    disposeScope(scope);
    throw error;
  } finally {
    documentOwner = previousDoc;
    cursor = previousCursor;
  }
  return () => {
    if (rootEnd && host.parentNode === rootEnd.parentNode)
      nodes = [host, ...rootNodes(host, rootEnd), rootEnd];
    disposeScope(scope);
    if (owner._pc === scope) owner._pc = null;
    for (const node of nodes) node.remove();
  };
}
export function hydrate<P>(
  host: Element,
  make: Component<P>,
  props?: P,
  values?: Record<string, Value<unknown>>,
  actions?: Record<string, (...args: any[]) => any>,
): () => void {
  const existing = hydratedRoots.get(host);
  if (existing) {
    if (existing.make !== make) throw new Error("publr-dom: component hydration mismatch");
    if (values) Object.assign(values, existing.values);
    if (actions) Object.assign(actions, existing.actions);
    return existing.dispose;
  }
  const seed = readSeed<P>(host);
  values ??= {};
  actions ??= {};
  const dispose = mount(host, make, props ?? seed?.props, {
    hydrate: true,
    initial: seed,
    values,
    actions,
  });
  hydratedRoots.set(host, { make, dispose, values, actions });
  return dispose;
}
export { render };

/** One child value as a node: a node itself, a thunk as its own region, text otherwise. */
function child(value: unknown): Node {
  if (typeof value === "function") return insert(value as () => unknown);
  if (value && typeof value === "object" && "nodeType" in value) return value as Node;
  return literal(value);
}
/** The compiler hands several children as an array, with a thunk for each
 * reactive expression among them. Under a hydration cursor each child has
 * already claimed its place, so only a fresh render collects them. */
function children(value: unknown): Node {
  if (!Array.isArray(value)) return child(value);
  const output = doc().createDocumentFragment();
  for (const item of value.flat(Infinity) as unknown[]) {
    if (item == null || typeof item === "boolean") continue;
    const node = child(item);
    if (!cursor) output.append(node);
  }
  return output;
}
const sameChildren = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => sameChildren(item, b[index])));
/** Unknown child values need a shared dynamic region; known structure is emitted directly. */
export function insert(read: () => unknown): Node {
  // JSX expression markers also represent empty text. Node-valued expressions
  // are mounted lazily in their own owner and retire on replacement.
  const target = range("insert");
  let mounted: Mounted | undefined;
  let previous: unknown = Symbol();
  let initial = true;
  render(read, (value) => {
    if (sameChildren(previous, value)) return;
    const make = () => children(value);
    if (
      mounted?.nodes.length === 1 &&
      mounted.nodes[0].nodeType === 3 &&
      !(value && typeof value === "object") &&
      typeof value !== "function"
    ) {
      (mounted.nodes[0] as Text).data = display(value);
    } else {
      retire(mounted);
      mounted = build(make, target, initial && target.adopted);
    }
    previous = value;
    initial = false;
  });
  onCleanup(() => retire(mounted));
  return target.output;
}

export function fragment(make: () => Node[]): Node {
  const target = range("fragment");
  const previous = cursor;
  if (target.adopted)
    cursor = { parent: target.end.parentNode!, next: target.start.nextSibling, end: target.end };
  try {
    const nodes = make();
    if (target.adopted) {
      if (cursor?.next !== target.end) throw new Error("publr-dom: unclaimed fragment content");
    } else for (const node of nodes) target.end.parentNode!.insertBefore(node, target.end);
  } finally {
    cursor = previous;
  }
  return target.output;
}

/** Factory used only by generated HTML companions. DOM-only bundles omit it. */
export function localComponent<P>(make: Component<P>) {
  return compiledFactory(() => {
    const state: Record<string, unknown> = {};
    const actions: Record<string, (...args: any[]) => any> = {};
    return {
      state,
      actions,
      init: ({ el }: { el: Element }) => {
        const values: Record<string, Value<unknown>> = {};
        const dispose = hydrate(el, make, undefined, values, actions);
        Object.defineProperties(state, Object.getOwnPropertyDescriptors(bindings(values)));
        return dispose;
      },
    };
  });
}

/** Compiler-only contracts; callback parameters are lowered to live readers. */
export function forEach<T>(
  read: () => readonly T[] | null | undefined,
  key: ((item: T) => string | number) | undefined,
  make: (item: () => T, index: () => number) => Node,
  fallback?: () => Node,
  keyed = true,
): Node {
  if (!keyed && key) throw new Error("publr: positional For cannot have a key");
  const values = () => {
    const value = read();
    if (value != null && !Array.isArray(value)) throw new Error("publr: For each must be an array");
    return value ?? [];
  };
  const identity = (item: T, index: number) => {
    if (!keyed) return index;
    const id = key ? pure(() => key(item)) : item;
    if (typeof id !== "string" && !(typeof id === "number" && Number.isFinite(id))) {
      throw new Error("publr: For keys must be strings or finite numbers; object rows require key");
    }
    return Object.is(id, -0) ? 0 : id;
  };
  return when(
    () => values().length > 0,
    () => list(values, identity, make),
    fallback,
  );
}

export function repeat(
  from: () => number,
  count: () => number,
  make: (index: number) => Node,
): Node {
  return list(
    () => {
      const start = from();
      const size = count();
      if (
        !Number.isSafeInteger(start) ||
        start < 0 ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !Number.isSafeInteger(start + size)
      ) {
        throw new Error("publr: Repeat requires nonnegative safe integers and a safe endpoint");
      }
      return Array.from({ length: size }, (_, index) => start + index);
    },
    (index) => index,
    (index) => make(index()),
  );
}

export function choose(
  matches: Array<{ when: () => unknown; make: () => Node; keyed?: boolean }>,
  fallback?: () => Node,
): Node {
  let selected = -1;
  let previous: unknown;
  let token = {};
  return when(
    () => {
      let index = -1;
      let value: unknown;
      for (let i = 0; i < matches.length; i++) {
        const next = matches[i].when();
        if (next) {
          index = i;
          value = next;
          break;
        }
      }
      if (index !== selected || (index >= 0 && matches[index].keyed && !Object.is(value, previous)))
        token = {};
      selected = index;
      previous = value;
      return index < 0 ? false : token;
    },
    () => matches[selected].make(),
    fallback,
    true,
  );
}

function rootNodes(host: Element, end: Element): ChildNode[] {
  const nodes: ChildNode[] = [];
  for (let node = host.nextSibling; node && node !== end; node = node.nextSibling) nodes.push(node);
  return nodes;
}

/** Compiler-owned directives attach in the row/branch owner, after DOM insertion. */
export function enhance(
  node: Element,
  names: Array<"position" | "portal" | "focus" | "ref">,
): void {
  const wired = ((node as PublrElement)._pd ??= new Set());
  const pending = names.filter((name) => !wired.has(name));
  for (const name of pending) {
    wired.add(name);
    onCleanup(() => wired.delete(name));
  }
  postEffect(() => {
    const wiring = { position: wirePosition, portal: wirePortal, focus: wireFocus, ref: wireRef };
    for (const name of pending) wiring[name](node, "data-p-" + name);
  });
}
