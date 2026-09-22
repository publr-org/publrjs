// Explicit imports keep compiler output tree-shakeable and share one graph.
export { state, derived, bindings } from "./core/graph";
export { awaited, isPending, isError, errorOf, refresh, valueOf } from "./core/graph";
export { postEffect as effect, onCleanup, untrack } from "./core/reactivity";
export type { Value, State, AsyncValue, AwaitedOptions } from "./core/graph";

export {
  PORTABLE_SEMANTICS_VERSION,
  encodeScalar as encodePortableScalar,
  decodeScalar as decodePortableScalar,
} from "./core/semantics";

export { captureActions } from "./core/transfer";

export { ref } from "./core/ref";
export { portal, unportal } from "./core/portal";
