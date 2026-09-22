import { reactive } from "./reactive";
import { onCleanup, untrack } from "./reactivity";

/** An explicitly invoked write. Failures are exposed as state; run resolves undefined. */
class MutationState<Args extends unknown[], T> {
  private readonly status = reactive({
    isPending: false,
    isError: false,
    error: undefined as unknown,
    value: undefined as T | undefined,
  });
  private active: Promise<T | undefined> | undefined;
  private disposed = false;

  constructor(private readonly operation: (...args: Args) => T | PromiseLike<T>) {
    onCleanup(() => {
      this.disposed = true;
    });
  }

  get isPending(): boolean {
    return this.status.isPending;
  }
  get isError(): boolean {
    return this.status.isError;
  }
  get error(): unknown {
    return this.status.error;
  }
  get value(): T | undefined {
    return this.status.value;
  }

  /** Concurrent calls share the first call's arguments and promise. */
  readonly run = (...args: Args): Promise<T | undefined> => {
    if (this.disposed) return Promise.resolve(undefined);
    if (this.active) return this.active;
    this.status.isPending = true;
    this.status.isError = false;
    this.status.error = undefined;
    this.active = Promise.resolve()
      .then(() => untrack(() => this.operation(...args)))
      .then(
        (value) => {
          if (!this.disposed) this.status.value = value;
          return value;
        },
        (error: unknown) => {
          if (!this.disposed) {
            this.status.error = error;
            this.status.isError = true;
          }
          return undefined;
        },
      )
      .finally(() => {
        this.active = undefined;
        if (!this.disposed) this.status.isPending = false;
      });
    return this.active;
  };
}

/** A callable write with reactive status and its last successful result. */
export interface MutationResult<Args extends unknown[], T> {
  (...args: Args): Promise<T | undefined>;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly value: T | undefined;
}

/** Create an idle action. Calling it explicitly starts the write. */
export function mutation<Args extends unknown[], T>(
  operation: (...args: Args) => T | PromiseLike<T>,
): MutationResult<Args, T> {
  const state = new MutationState(operation);
  return Object.defineProperties(state.run, {
    isPending: { get: () => state.isPending },
    isError: { get: () => state.isError },
    error: { get: () => state.error },
    value: { get: () => state.value },
  }) as MutationResult<Args, T>;
}
