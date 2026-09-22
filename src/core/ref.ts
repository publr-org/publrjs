import { onCleanup, track, trigger } from "./reactivity";
import type { PublrElement, Ref } from "./types";

/**
 * A callable element reference shared by direct JSX mounting and restored
 * server HTML. JSX calls it with the mounted element; `data-p-ref` restoration
 * does the same and clears it with the owning island.
 */
export const ref = <T extends Element | null = Element | null>(
  mount?: (element: NonNullable<T>) => void | (() => void),
): Ref<T> => {
  const target = ((value: T) => {
    target.current = value;
    if (value) {
      const dispose = mount?.(value as NonNullable<T>);
      onCleanup(() => {
        dispose?.();
        if (target.current === value) target.current = null as T;
      });
    }
  }) as Ref<T>;
  let current = null as T;
  Object.defineProperty(target, "current", {
    get() {
      track(target, "current");
      return current;
    },
    set(value: T) {
      const previous = current;
      current = value;
      if (previous !== value) trigger(target, "current", previous, value);
    },
  });
  return target;
};

export const wireRef = (el: Element, attr: string): void => {
  const names = el.getAttribute(attr);
  if (!names) return;

  for (const name of new Set(names.split(";"))) {
    let owner: Element | null = el;
    while (owner) {
      const refs = (owner as PublrElement)._ps?.[4];
      const target = refs?.[name];
      if (target) {
        target(el);
        break;
      }
      owner = owner.parentElement;
    }
  }
};
