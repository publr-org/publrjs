// Native transport captures this context synchronously when an awaited callback runs.
let signal: AbortSignal | undefined;
export const operationSignal = (): AbortSignal | undefined => signal;
export function withOperationSignal<T>(next: AbortSignal, run: () => T): T {
  const previous = signal;
  signal = next;
  try {
    return run();
  } finally {
    signal = previous;
  }
}
