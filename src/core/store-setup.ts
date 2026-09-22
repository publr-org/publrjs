// Awaited callbacks in a definition start after its seeded, reactive state is bound.
let pending: Array<() => void> | undefined;

export function prepareStore<T>(factory: () => T): [T, () => void] {
  const previous = pending;
  const callbacks: Array<() => void> = [];
  pending = callbacks;
  try {
    const definition = factory();
    return [
      definition,
      () => {
        for (const start of callbacks.splice(0)) start();
      },
    ];
  } finally {
    pending = previous;
  }
}

export function afterStoreSetup(start: () => void): void {
  if (pending) pending.push(start);
  else start();
}
