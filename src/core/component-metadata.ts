// Registration owns component classification; the DOM needs only its store reference.
export const compiledFactories = new WeakSet<Function>();
export function compiledFactory<T extends Function>(factory: T): T {
  compiledFactories.add(factory);
  return factory;
}
export function isStoreBoundary(el: Element): boolean {
  return (
    el.hasAttribute("data-p-store") ||
    el.hasAttribute("data-p-html") ||
    el.hasAttribute("data-p-component")
  );
}

/** Structural roots are properly nested ranges, not globally named instances. */
export function structuralRootEnd(host: Element): Element | undefined {
  if (!host.hasAttribute("data-p-root-start")) return;
  let depth = 0;
  for (let node = host.nextElementSibling; node; node = node.nextElementSibling) {
    if (node.hasAttribute("data-p-root-start")) depth++;
    if (node.hasAttribute("data-p-root-end")) {
      if (depth === 0) return node;
      depth--;
    }
  }
  throw new Error("publr: missing structural root closing template");
}
