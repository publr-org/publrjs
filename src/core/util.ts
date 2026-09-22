// Byte-saving helpers. Platform globals and methods like `getAttribute` or
// `typeof x === "function"` cannot be minified by esbuild — routing the hot
// ones through 1–2 char-minifiable wrappers measurably shrinks the bundle.
// Behavior-neutral by construction; keep these free of runtime state.

import { onCleanup } from "./reactivity";

/** el.getAttribute(name) */
export const ga = (el: Element, name: string): string | null => el.getAttribute(name);

/** typeof v === "function" */
export const isFn = (v: unknown): v is (...args: any[]) => any => typeof v === "function";

/** typeof v === "object" (null is an object here — pair with a truthiness check) */
export const isObj = (v: unknown): boolean => typeof v === "object";

/** null/undefined → "", anything else → String(v) */
export const str = (v: unknown): string => (v == null ? "" : String(v));

/** Write `str(v)` to `el[key]` only when it actually changed. */
export const setIfChanged = (el: any, key: string, v: unknown): void => {
  const next = str(v);

  if (el[key] !== next) {
    el[key] = next;
  }
};

/** addEventListener + scope-cleaned removeEventListener. */
export const listen = (
  target: EventTarget,
  name: string,
  fn: EventListener,
  opts?: AddEventListenerOptions | false,
): void => {
  target.addEventListener(name, fn, opts as AddEventListenerOptions);
  onCleanup(() => target.removeEventListener(name, fn, opts as AddEventListenerOptions));
};
