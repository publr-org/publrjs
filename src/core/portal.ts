// Portal: move an element to a fixed portal root so it escapes overflow/
// stacking contexts (dropdowns, dialogs, tooltips), and restore it on cleanup.
// Carries the `.dark` class forward so portaled content keeps the theme
// cascade. Authored as `@portal` (→ data-p-portal); also exposed imperatively
// as Publr.portal / Publr.unportal for component plugins.
//
// Portal state lives in ONE expando (`_pp = [authored parent, authored next
// sibling, added .dark?]`, null when not portaled — see types.ts); `_pw`
// marks data-p-portal wiring.

import { onCleanup, postEffect } from "./reactivity";
import type { PublrElement } from "./types";

import { directiveValue } from "./directive-value";

export type ElementTarget = Element | { readonly current: Element | null } | string;
export type PortalTarget = ElementTarget | boolean | null;

export function resolveTarget(element: Element, target: ElementTarget): Element | null {
  if (typeof target === "string") {
    try {
      return element.ownerDocument.querySelector(target);
    } catch {
      return null;
    }
  }
  return "current" in target ? target.current : target;
}

const pointerEvents = new WeakMap<Element, string>();
const portalRoots = new WeakMap<Document, HTMLElement>();

const rootFor = (doc: Document): HTMLElement => {
  const existing = portalRoots.get(doc);
  if (existing?.isConnected) return existing;

  const root = doc.createElement("div");
  root.id = "publr-portal";
  root.style.cssText = "position:fixed;top:0;left:0;z-index:9999;pointer-events:none;";
  doc.body.appendChild(root);
  portalRoots.set(doc, root);
  return root;
};

export const portal = (element: Element, target: PortalTarget = true): (() => void) => {
  const el = element as PublrElement;
  if (target === false || target == null) {
    unportal(el);
    return () => {};
  }
  // Capture before creating the default root: it must not become the saved sibling.
  const parent = el.parentNode;
  const next = el.nextSibling;
  const destination =
    target === true || target === "" ? rootFor(el.ownerDocument) : resolveTarget(el, target);
  if (!destination || destination.ownerDocument !== el.ownerDocument || el.contains(destination)) {
    unportal(el);
    console.error("publr: portal target is missing or invalid", target);
    return () => {};
  }
  if (!el._pp) {
    const dark = !!(parent as Element | null)?.closest?.(".dark") && !el.classList.contains("dark");
    el._pp = [parent, next, dark];
    pointerEvents.set(el, el.style.pointerEvents);
    el.style.pointerEvents = "auto";
    if (dark) el.classList.add("dark");
  }
  if (el.parentNode !== destination) movePreservingFocus(el, destination, null);
  return () => unportal(el);
};

export const unportal = (element: Element): void => {
  const el = element as PublrElement;
  const saved = el._pp;

  if (!saved) {
    return;
  }

  if (saved[0]) {
    movePreservingFocus(el, saved[0], saved[1]?.parentNode === saved[0] ? saved[1] : null);
  }

  el.style.pointerEvents = pointerEvents.get(el) ?? "";
  pointerEvents.delete(el);

  if (saved[2]) {
    el.classList.remove("dark");
  }

  el._pp = null;
};

// Portal runs AFTER the directive + structural passes so the element and its
// subtree are fully wired before the node is relocated (bindings live on the
// node, so they survive the move).
export const wirePortal = (element: Element): void => {
  const el = element as PublrElement;

  if (!el._pw) {
    el._pw = true;
    postEffect(() => {
      const target = directiveValue(el, "data-p-portal") as PortalTarget;
      // Reading .current inside the effect also follows later ref changes.
      const resolved =
        target && typeof target !== "boolean" && typeof target !== "string"
          ? resolveTarget(el, target)
          : target;
      if (resolved == null && target != null) {
        unportal(el);
        console.error("publr: portal target ref is not attached", target);
      } else portal(el, resolved);
    });
    onCleanup(() => {
      unportal(el);
      el._pw = false;
    });
  }
};

function movePreservingFocus(element: Element, parent: ParentNode, before: ChildNode | null): void {
  const doc = element.ownerDocument;
  const active = doc.activeElement as HTMLElement | null;
  const restore = active && element.contains(active);
  if ("moveBefore" in parent && element.isConnected && parent.isConnected) {
    (parent as Element & { moveBefore(node: Node, before: Node | null): void }).moveBefore(
      element,
      before,
    );
  } else parent.insertBefore(element, before);
  if (restore && active.isConnected && doc.activeElement !== active)
    active.focus({ preventScroll: true });
}
