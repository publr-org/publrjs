// Shared test harness. Every test gets a FRESH runtime (module registries are
// singletons — sharedStores, subscriber sets, hook arrays) and a clean DOM,
// loaded in the real order: runtime import → store registration → markup →
// explicit hydrate. Tests exercise only the public entries, never core/*.

import { vi } from "vitest";

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Read a reactive value purely to register it as an effect dependency. */
export function touch(_value: unknown): void {}

export type Runtime = typeof import("../src/publr");

export async function loadRuntime(
  opts: { query?: boolean; router?: boolean } = {},
): Promise<Runtime> {
  vi.resetModules();
  document.body.innerHTML = "";
  const core = await import("../src/publr");

  if (opts.query) {
    await import("../src/addons/query");
  }

  if (opts.router) {
    await import("../src/addons/router");
  }

  // Let the runtime's own load-time hydrate (empty document) settle.
  await tick();
  return core;
}

/**
 * Intercept queueMicrotask so deferred work (flush, getter memoization) can be
 * run synchronously inside expect(...).toThrow(). Restore in a finally.
 */
export function captureMicrotasks() {
  const original = globalThis.queueMicrotask;
  const queue: Array<() => void> = [];
  globalThis.queueMicrotask = (cb: () => void) => queue.push(cb);

  return {
    runAll() {
      while (queue.length) {
        queue.shift()!();
      }
    },
    restore() {
      globalThis.queueMicrotask = original;
    },
  };
}

export function html(markup: string): void {
  document.body.innerHTML = markup;
}

export function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no element matches ${selector}`);
  return el;
}

export function $$(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

export function fire(el: EventTarget, type: string, init: EventInit = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

export function key(el: EventTarget, type: string, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  el.dispatchEvent(event);
  return event;
}

/** A promise plus its resolve/reject handles, for controllable async fetches. */
export function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export type Jsx = typeof import("../src/addons/dom");

/**
 * Class-conflict groups for the utilities the suites stack. In a real build
 * the pjsx plugin registers these from the JIT per module; tests use a
 * readable table with the same shape (`[scope, [property…]]`).
 */
export const TEST_CLASS_GROUPS: import("../src/addons/class-merge").ClassGroups = {
  "px-2.5": ["base", ["padding-left", "padding-right"]],
  "px-0": ["base", ["padding-left", "padding-right"]],
  "px-2": ["base", ["padding-left", "padding-right"]],
  "px-4": ["base", ["padding-left", "padding-right"]],
  "p-4": ["base", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
  "py-2": ["base", ["padding-top", "padding-bottom"]],
  "bg-red-500": ["base", ["background-color"]],
  "bg-blue-500": ["base", ["background-color"]],
  "hover:bg-red-500": ["hover", ["background-color"]],
  "hover:bg-blue-500": ["hover", ["background-color"]],
  "hover:px-4": ["hover", ["padding-left", "padding-right"]],
  "focus:px-2": ["focus", ["padding-left", "padding-right"]],
  "p-4!": ["base!", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
  "p-2!": ["base!", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
  "p-2": ["base", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
  "[padding:1px]": [
    "base",
    [
      "arbitrary:padding-top",
      "arbitrary:padding-right",
      "arbitrary:padding-bottom",
      "arbitrary:padding-left",
    ],
  ],
  rounded: ["base", ["radius-tl", "radius-tr", "radius-br", "radius-bl"]],
  "rounded-t-none": ["base", ["radius-tl", "radius-tr"]],
  "rounded-md": ["base", ["radius-tl", "radius-tr", "radius-br", "radius-bl"]],
  "text-sm": ["base", ["font-size", "line-height"]],
  "text-lg": ["base", ["font-size", "line-height"]],
  "leading-8": ["base", ["line-height"]],
  "h-8": ["base", ["height"]],
  "w-8": ["base", ["width"]],
};

/** Import the jsx addon with the test class-conflict table registered. */
export async function loadJsx(): Promise<Jsx> {
  const jsx = await import("../src/addons/dom");
  return jsx;
}
