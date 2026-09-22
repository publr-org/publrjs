import { onCleanup } from "./reactivity";

const scopes = new WeakMap<Element, () => void>();
const focusable = "a[href],button,input,select,textarea,[tabindex]";

/** A JSX focusScope keeps keyboard focus inside an active panel, including late HTML. */
export const setFocusScope = (root: Element, active: unknown): void => {
  scopes.get(root)?.();
  scopes.delete(root);
  if (!active) return;
  const keydown = (event: Event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Tab" || event.defaultPrevented) return;
    const items = [...root.querySelectorAll<HTMLElement>(focusable)].filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-disabled") !== "true" &&
        element.getClientRects().length > 0,
    );
    const current = root.ownerDocument.activeElement;
    const index = items.indexOf(current as HTMLElement);
    if (!items.length || (event.shiftKey ? index <= 0 : index < 0 || index === items.length - 1)) {
      event.preventDefault();
      (items[event.shiftKey ? items.length - 1 : 0] ?? (root as HTMLElement)).focus();
    }
  };
  root.addEventListener("keydown", keydown);
  scopes.set(root, () => root.removeEventListener("keydown", keydown));
};

export const ownFocusScope = (root: Element): void => {
  onCleanup(() => setFocusScope(root, false));
};

export const wireFocus = (root: Element): void => {
  ownFocusScope(root);
  setFocusScope(root, true);
};
