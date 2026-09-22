import { containerFor } from "./container";
import { resolveRef } from "./resolve";
import type { State } from "./types";

const initialText = new WeakMap<Element, { ref: string; text: string }>();

// Adopt server text once, while a local store is being instantiated. Explicit
// data-p seeds are applied afterwards; compiled state transfer remains authoritative.
export function seedText(root: Element, state: State): void {
  if (root.hasAttribute("data-p-state")) return;
  const seen = new Set<string>();
  const candidates = [root, ...root.querySelectorAll("[data-p-text]")];
  for (const el of candidates) {
    if (el.closest("[data-p-store]") !== root || containerFor(el) !== containerFor(root)) continue;
    const ref = el.getAttribute("data-p-text")?.trim();
    if (!ref || !/^\$?[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/.test(ref)) continue;
    const path = ref.replace(/^\$/, "");
    const keys = path.split(".");
    // A composed child's unqualified text may belong to an ancestor store.
    // Do not invent a local field that would shadow that live binding.
    if (!(keys[0] in state) && root.parentElement) {
      const [ancestor] = resolveRef(path, root.parentElement);
      if (ancestor && keys[0] in ancestor[0]) continue;
    }

    if (keys.some((key) => ["__proto__", "prototype", "constructor"].includes(key))) continue;
    let snapshot = initialText.get(el);
    if (!snapshot || snapshot.ref !== ref) {
      snapshot = { ref, text: el.textContent ?? "" };
      initialText.set(el, snapshot);
    }
    const text = snapshot.text;
    // Empty elements are output placeholders, not serialized defaults.
    if (!text.length || seen.has(path)) continue;
    let target: State | undefined = state;
    for (const key of keys.slice(0, -1)) {
      const descriptor: PropertyDescriptor | undefined =
        target && Object.getOwnPropertyDescriptor(target, key);
      const value: unknown = descriptor && "value" in descriptor ? descriptor.value : undefined;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        target = undefined;
        break;
      }
      target = value as State;
    }
    if (!target) continue;
    const key = keys.at(-1)!;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    // Computed/accessor bindings are outputs, never initialization inputs.
    if (descriptor && (!("value" in descriptor) || !descriptor.writable)) continue;
    const initial = descriptor?.value;
    let value: string | number | boolean | bigint;
    switch (typeof initial) {
      case "number":
        value = Number(text);
        if (!text.trim() || !Number.isFinite(value)) continue;
        break;
      case "boolean":
        if (text.trim() !== "true" && text.trim() !== "false") continue;
        value = text.trim() === "true";
        break;
      case "bigint":
        if (!/^[+-]?\d+$/.test(text.trim())) continue;
        value = BigInt(text.trim());
        break;
      case "string":
      case "undefined":
        value = text;
        break;
      default:
        if (initial !== null) continue;
        value = text;
    }
    target[key] = value;
    seen.add(path);
  }
}
