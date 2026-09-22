import {
  state as createState,
  awaited as createAwaited,
  type AsyncValue,
  type AwaitedOptions,
  type State,
} from "./core/graph";

/** These declarations are compiled by PJSX. Calling them uncompiled is an error. */
function uncompiled(name: string): never {
  throw new Error(
    `publr: ${name} requires PJSX compilation; compile this module before executing it`,
  );
}
export function state<T>(initial: T): State<T> {
  return createState(initial);
}
export function derived<T>(_compute: () => T): T {
  return uncompiled("derived");
}
/** A callback result owns its loading state and retains its last successful value. */
export class AwaitedResult<T> {
  constructor(private readonly binding: AsyncValue<T>) {}
  get value(): T | undefined {
    return this.binding.peek();
  }
  get isPending(): boolean {
    return this.binding.pending();
  }
  get isLoaded(): boolean {
    return this.binding.loaded();
  }
  get isError(): boolean {
    return this.binding.isError();
  }
  get error(): unknown {
    return this.binding.error();
  }
  refresh(): void {
    this.binding.refresh();
  }
}

type OperationValue<T> =
  Awaited<T> extends import("./core/query-cache").OperationResult<infer V> ? V : Awaited<T>;

export function awaited<T>(
  operation: () => T,
  options?: AwaitedOptions<OperationValue<T>>,
): AwaitedResult<OperationValue<T>>;
/** PTSX operation-call form: the compiler supplies the tracking callback. */
export function awaited<T>(
  operation: T,
  options?: { cache: import("./core/query-cache").CacheOptions },
): OperationValue<T>;
export function awaited(operation: unknown, options?: AwaitedOptions<unknown>): unknown {
  if (typeof operation !== "function") return uncompiled("awaited");
  return new AwaitedResult(createAwaited(operation as () => unknown, options));
}
export function isPending(_value: unknown): boolean {
  return uncompiled("isPending");
}
export function errorOf(_value: unknown): unknown {
  return uncompiled("errorOf");
}
export function refresh(_value: unknown): void {
  return uncompiled("refresh");
}

export function valueOf<T>(value: T): T {
  return value;
}

export function Show(_props: {
  when: unknown;
  keyed?: boolean;
  fallback?: Node;
  children?: Node;
}): Node {
  return uncompiled("Show");
}
export function Match(_props: { when: unknown; keyed?: boolean; children?: Node }): Node {
  return uncompiled("Match");
}
export function Switch(_props: { fallback?: Node; children?: Node | Node[] }): Node {
  return uncompiled("Switch");
}
export type ForProps<T> = {
  each: readonly T[] | null | undefined;
  fallback?: Node;
  children: (item: T, index: number) => Node;
} & (
  | { keyed: false; key?: never }
  | ({ keyed?: true } & ([T] extends [string | number]
      ? { key?: (item: T) => string | number }
      : { key: (item: T) => string | number }))
);

export function For<T>(_props: ForProps<T>): Node {
  return uncompiled("For");
}
export function Repeat(_props: {
  from?: number;
  count: number;
  children: (index: number) => Node;
}): Node {
  return uncompiled("Repeat");
}
