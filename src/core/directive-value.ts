// Keep element references and option objects out of serialized attributes.
import { track, trigger } from "./reactivity";

import type { PublrElement } from "./types";

export function directiveValue(element: Element, name: string): unknown {
  track(element, name);
  const stored = (element as PublrElement)._pv;
  return stored?.has(name) ? stored.get(name) : element.getAttribute(name);
}

export function setDirectiveValue(element: Element, name: string, value: unknown): boolean {
  if (name !== "data-p-portal" && name !== "data-p-position") return false;
  let stored = (element as PublrElement)._pv;
  if (!stored) (element as PublrElement)._pv = stored = new Map();
  const previous = stored.get(name);
  stored.set(name, value);
  // Keep a discovery marker even when disabled, so a later true/object value
  // works in hydrated HTML as well as in directly mounted DOM.
  const serialized = typeof value === "string" ? value : "";
  if (element.getAttribute(name) !== serialized) element.setAttribute(name, serialized);
  if (!Object.is(previous, value)) trigger(element, name, previous, value);
  return true;
}
