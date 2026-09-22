// Structural <template> directive: data-p-for (keyed list rendering). It clones
// the template's first element and hydrates the clone inside its own scope so
// teardown is per-instance.
//
// NOTE: this module and lifecycle.ts import each other (clones re-enter
// hydrate). The cycle is safe — `hydrate` is only referenced inside function
// bodies called at runtime, never during module initialization.

import { reactive } from "./reactive";
import { createScope, disposeScope, effect, onCleanup, runInScope } from "./reactivity";
import { resolvePath, stripStatePrefix } from "./parse";
import { bindPredicate, resolveRef } from "./resolve";
import { STORE_ATTR } from "./store";
import { hydrate, destroy } from "./lifecycle";
import { ga } from "./util";
import type { PublrElement, Scope } from "./types";

/** A mounted clone: [node, scope]. */
type Rendered = [PublrElement, Scope];

const prototypes = new WeakMap<Element, Map<string, HTMLTemplateElement>>();

// The template that carries an anchor's content and directive: itself when it has
// content, else the one registered under the same id by an enclosing prototype. A
// server-rendered row repeats neither the markup nor the spec of its anchors.
const sourceFor = (tpl: HTMLTemplateElement): HTMLTemplateElement | null => {
  const owner = tpl.parentElement;
  if (tpl.content?.firstElementChild && owner) {
    const registry = prototypes.get(owner) ?? new Map<string, HTMLTemplateElement>();
    const pending = [tpl];
    while (pending.length) {
      const template = pending.pop()!;
      const id = template.getAttribute("data-p-template");
      if (id && template.content.firstElementChild) registry.set(id, template);
      pending.push(
        ...template.content.querySelectorAll<HTMLTemplateElement>("template[data-p-template]"),
      );
    }
    prototypes.set(owner, registry);
    return tpl;
  }
  const id = tpl.getAttribute("data-p-template");
  for (
    let ancestor: Element | null = owner;
    ancestor;
    ancestor = ((ancestor as PublrElement)._pp?.[0] as Element | null) ?? ancestor.parentElement
  ) {
    const found = id && prototypes.get(ancestor)?.get(id);
    if (found) return found;
  }
  return null;
};

// An anchor's directive value: its own when set, else its source template's.
const specOf = (tpl: Element, source: Element, attr: string): string | null =>
  ga(tpl, attr) || ga(source, attr);

// Shared template-directive prelude: once-guard + prototype + parent + source.
// Null when the template is already bound or has no element child.
const tplParts = (
  el: Element,
): [HTMLTemplateElement & PublrElement, Element, Element, HTMLTemplateElement] | null => {
  const tpl = el as HTMLTemplateElement & PublrElement;

  if (tpl._pb) {
    return null;
  }

  tpl._pb = true;
  const source = sourceFor(tpl);
  const proto = source?.content.firstElementChild;

  return proto ? [tpl, proto, tpl.parentElement!, source!] : null;
};

// Clone `proto`, insert it after `after`, and hydrate it inside a fresh scope
// (`prep` runs on the bare clone first — @for uses it to attach the row store).
const mountClone = (
  proto: Element,
  parent: Element,
  after: Element,
  prep?: (node: PublrElement) => void,
): Rendered => {
  const node = proto.cloneNode(true) as PublrElement;
  prep?.(node);
  const scope = createScope();
  node._pc = scope;
  parent.insertBefore(node, after.nextSibling);
  runInScope(scope, () => hydrate(node));

  return [node, scope];
};

const unmount = ([node, scope]: Rendered): void => {
  destroy(node);
  disposeScope(scope);
  node.remove();
};

export const setupIf = (el: Element, attr: string): void => {
  const parts = tplParts(el);
  if (!parts) return;
  const [tpl, proto, parent, source] = parts;
  const inverse = tpl.hasAttribute("data-p-if-not") || source.hasAttribute("data-p-if-not");
  let initial = tpl.nextElementSibling as PublrElement | null;
  if (!initial?.hasAttribute("data-p-if-row")) initial = null;
  let rendered: Rendered | undefined;
  onCleanup(() => {
    if (rendered) unmount(rendered);
  });
  bindPredicate(tpl, specOf(tpl, source, attr)!, (value) => {
    if (Boolean(value) !== inverse) {
      if (rendered) return;
      if (initial) {
        const node = initial;
        initial = null;
        node.removeAttribute("data-p-if-row");
        const scope = createScope();
        node._pc = scope;
        runInScope(scope, () => hydrate(node));
        rendered = [node, scope];
      } else rendered = mountClone(proto, parent, tpl);
    } else {
      if (rendered) unmount(rendered);
      rendered = undefined;
      initial?.remove();
      initial = null;
    }
  });
};

export const setupFor = (el: Element, attr: string): void => {
  const tp = tplParts(el);

  if (!tp) {
    return;
  }

  const [tpl, proto, parent, source] = tp;
  const spec = specOf(tpl, source, attr)!;
  const ofIndex = spec.indexOf(" of ");

  if (ofIndex < 0) {
    return;
  }

  const alias = spec.slice(0, ofIndex).trim();
  const keyAttr = specOf(tpl, source, "data-p-key") || "";
  const [store, rest] = resolveRef(spec.slice(ofIndex + 4).trim(), tpl);

  if (!store) {
    return;
  }

  const rendered = new Map<unknown, Rendered>();
  const initial = new Map<unknown, PublrElement>();
  let sibling = tpl.nextElementSibling;
  while (sibling?.hasAttribute("data-p-for-key")) {
    const key: unknown = JSON.parse(sibling.getAttribute("data-p-for-key")!);
    if (initial.has(key)) throw new Error("publr: duplicate server list key");
    initial.set(key, sibling as PublrElement);
    sibling = sibling.nextElementSibling;
  }

  onCleanup(() => {
    for (const [node] of rendered.values()) destroy(node);
  });

  effect(() => {
    const items: unknown[] = resolvePath(store[0], rest) || [];
    const liveKeys = new Set<unknown>();
    let previousNode: Element = tpl;

    items.forEach((item, index) => {
      // `:key="item.id"` is a path relative to the loop alias; resolve it
      // against a scope binding the alias to the current item.
      const key = keyAttr ? resolvePath({ [alias]: item }, stripStatePrefix(keyAttr)) : index;
      if (liveKeys.has(key)) throw new Error("publr: duplicate list key");
      liveKeys.add(key);
      let entry = rendered.get(key);

      if (entry) {
        const state = entry[0]._ps![0];

        if (state[alias] !== item) {
          state[alias] = item;
        }

        if (previousNode.nextSibling !== entry[0]) {
          parent.insertBefore(entry[0], previousNode.nextSibling);
        }
      } else {
        const prepare = (node: PublrElement) => {
          node.setAttribute(STORE_ATTR, alias);
          node._ps = [reactive({ [alias]: item }), {}];
        };
        const serverNode = initial.get(key);
        if (serverNode) {
          initial.delete(key);
          serverNode.removeAttribute("data-p-for-key");
          prepare(serverNode);
          const scope = createScope();
          serverNode._pc = scope;
          if (previousNode.nextSibling !== serverNode)
            parent.insertBefore(serverNode, previousNode.nextSibling);
          runInScope(scope, () => hydrate(serverNode));
          entry = [serverNode, scope];
        } else {
          entry = mountClone(proto, parent, previousNode, prepare);
        }
        rendered.set(key, entry);
      }

      previousNode = entry[0];
    });

    for (const [key, entry] of rendered) {
      if (!liveKeys.has(key)) {
        unmount(entry);
        rendered.delete(key);
      }
    }
    for (const node of initial.values()) {
      destroy(node);
      node.remove();
    }
    initial.clear();
  });
};
