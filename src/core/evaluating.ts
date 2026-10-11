// The element whose attribute is being evaluated, so `Publr.dataset()` inside an
// expression reads that element's own `data-<name>`, walking up as a wire does.

let evaluating: Element | null = null;

/** Run `read` as the evaluation of `node`'s attribute. */
export const evaluateAt = <T>(node: Element, read: () => T): T => {
  const previous = evaluating;
  evaluating = node;
  try {
    return read();
  } finally {
    evaluating = previous;
  }
};

export const evaluatingElement = (): Element | null => evaluating;
