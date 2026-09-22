import type { Value } from "./graph";
export interface Seed {
  values: Record<string, unknown>;
  cache?: Record<
    string,
    { revision?: number; key: unknown; expires: number; tags: string[]; noStore?: boolean }
  >;
}
/** Public data-p seeds use state names, with optional component props/cache metadata. */
export function readSeed<P = Record<string, unknown>>(
  el: Element,
): (Seed & { props?: P }) | undefined {
  const legacy = el.getAttribute("data-p-state");
  if (legacy) {
    const seed = JSON.parse(legacy);
    validateSeed(seed);
    return seed;
  }
  const text = el.getAttribute("data-p");
  if (!text) return;
  const payload = JSON.parse(text);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("publr: invalid component seed");
  const { $props: props, $cache: cache, ...values } = payload;
  const seed = { values, props: props as P | undefined, cache };
  validateSeed(seed);
  return seed;
}
export function validateSeed(seed: Seed): void {
  if (!seed.values || typeof seed.values !== "object" || Array.isArray(seed.values))
    throw new Error("publr: invalid transferred state");
  if (seed.cache === undefined) return;
  if (!seed.cache || typeof seed.cache !== "object" || Array.isArray(seed.cache))
    throw new Error("publr: invalid transferred cache");
  for (const value of Object.values(seed.cache)) {
    if (
      !value ||
      typeof value !== "object" ||
      !Object.hasOwn(value, "key") ||
      !Number.isFinite(value.expires) ||
      !Array.isArray(value.tags) ||
      !value.tags.every((tag) => typeof tag === "string") ||
      (value.revision !== undefined &&
        (!Number.isSafeInteger(value.revision) || value.revision < 0)) ||
      (value.noStore !== undefined && typeof value.noStore !== "boolean")
    )
      throw new Error("publr: invalid transferred cache policy");
  }
}
let current: Seed | undefined;
let actions: Record<string, (...args: any[]) => any> | undefined;
let collected: Record<string, Value<unknown>> | undefined;
export function withSeed<T>(
  seed: Seed | undefined,
  run: () => T,
  values?: Record<string, Value<unknown>>,
  handlers?: typeof actions,
): T {
  const previousActions = actions;
  actions = handlers;
  const previous = current;
  const previousValues = collected;
  collected = values;
  current = seed;
  try {
    return run();
  } finally {
    actions = previousActions;
    current = previous;
    collected = previousValues;
  }
}
export function initial(
  id: string | undefined,
): { value: unknown; cache?: NonNullable<Seed["cache"]>[string] } | undefined {
  if (id === undefined || !current) return;
  const name = publicName(id);
  const key = Object.hasOwn(current.values, id) ? id : name;
  return Object.hasOwn(current.values, key)
    ? { value: current.values[key], cache: current.cache?.[key] }
    : undefined;
}

export function expose(id: string | undefined, value: Value<unknown>): void {
  if (id && collected) collected[publicName(id)] = value;
}

function publicName(id: string): string {
  const separator = id.lastIndexOf("@");
  return separator < 0 ? id : id.slice(0, separator);
}

export function captureActions(handlers: Record<string, (...args: any[]) => any>): void {
  if (actions)
    for (const [name, handler] of Object.entries(handlers))
      actions[name] = (_dataset: unknown, context: { event?: Event }) => handler(context?.event);
}
