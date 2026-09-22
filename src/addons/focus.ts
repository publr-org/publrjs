// ─────────────────────────────────────────────────────────────────────────────
// PublrJS focus-trap addon — SOURCE OF TRUTH: publr-js/src/ (TypeScript).
// Built to dist/publr-focus.js by Vite, vendored by scripts/vendor-publr.sh.
// Trap Tab/Shift+Tab within a container, save + restore previous focus.
// Components that need it (dialog) `import { trapFocus } from
// "./publr-focus.js"`; deduped to one load per page by the module cache.
// No runtime dependency.
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface TrapFocusOptions {
  /** Element to focus initially instead of the first focusable. */
  initialFocusEl?: HTMLElement | null;
  /** Override the previously focused element on release. If focus fails, restore the previous element. */
  restoreFocusEl?: HTMLElement | null;
}

// Trap focus within container; returns a release() function. Focuses the first
// focusable element (or opts.initialFocusEl).
export function trapFocus(container: Element, opts: TrapFocusOptions = {}): () => void {
  const doc = container.ownerDocument;
  const focusable = () =>
    [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.matches(":disabled, input[type=hidden]") &&
          !el.closest("[hidden], [inert]"),
      )
      .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
  const items = focusable();
  if (!items.length) return () => {};

  const prevFocus = doc.activeElement as HTMLElement | null;

  if (opts.initialFocusEl) {
    opts.initialFocusEl.focus();
  } else {
    items[0].focus();
  }

  function handler(e: KeyboardEvent): void {
    if (e.key !== "Tab" || e.defaultPrevented) return;
    const els = focusable();
    if (!els.length) return;
    const current = els.indexOf(doc.activeElement as HTMLElement);
    const direction = e.shiftKey ? -1 : 1;
    let index = current < 0 ? (e.shiftKey ? 0 : -1) : current;
    // Own every Tab step: some browser keyboard-navigation preferences skip
    // buttons entirely, so relying on native middle steps can escape the trap.
    e.preventDefault();
    for (let attempt = 0; attempt < els.length; attempt++) {
      index = (index + direction + els.length) % els.length;
      els[index].focus();
      if (doc.activeElement === els[index]) break;
    }
  }

  container.addEventListener("keydown", handler as EventListener);

  return function release() {
    container.removeEventListener("keydown", handler as EventListener);
    const target = opts.restoreFocusEl;
    if (target?.isConnected) {
      target.focus();
      // The browser decides focusability, including CSS, inert ancestors and
      // programmatically focusable elements such as tabindex=-1.
      const root = target.getRootNode() as Document | ShadowRoot;
      if (root.activeElement === target) return;
    }
    prevFocus?.focus?.();
  };
}
