// Tailwind-aware class merging by TABLE. The Publr JIT (jit/src/class_merge.zig)
// resolves a class into a conflict group — `[scope, [property…]]`; merging is
// then a lookup: a later class in the same scope removes an earlier one whose
// properties it owns entirely. Same semantics as the engine.
//
// Where groups come from: the host installs a synchronous resolver
// (`setClassResolver`) — the editor points it at its live `jit_engine.wasm`
// instance — so a class is resolved the first time `mergeClasses()` sees it and cached.
// Tables can also be registered up front (`useClassGroups`). Without a resolver
// or a table entry a class is kept verbatim and never conflicts.

/** `[scope, properties]` — opaque hash strings from the JIT, compared only. */
export type ClassGroup = readonly [scope: string, properties: readonly string[]];
export type ClassGroups = Record<string, ClassGroup>;

const groups = new Map<string, ClassGroup>();
let resolver: ClassResolver | null = null;

/** Synchronous resolver for classes not yet tabled (the live JIT engine).
 * Returning null means "not ready yet": nothing is cached and the classes
 * are asked about again on the next merge. */
export type ClassResolver = (classes: readonly string[]) => ClassGroups | null;

/** Install (or clear with null) the resolver consulted for unknown classes. */
export const setClassResolver = (next: ClassResolver | null): void => {
  resolver = next;
};

/** Register (or extend) the class-conflict table. Additive; last write wins per class. */
export const useClassGroups = (table: ClassGroups): void => {
  for (const cls in table) groups.set(cls, table[cls]);
};

/** The registered group of a class, if any (tests / diagnostics). */
export const classGroup = (cls: string): ClassGroup | undefined => groups.get(cls);

const ownsAll = (incoming: readonly string[], existing: readonly string[]): boolean => {
  if (existing.length === 0 || incoming.length < existing.length) return false;
  for (const property of existing) {
    if (!incoming.includes(property)) return false;
  }
  return true;
};

/**
 * Merge a whitespace-separated class stack, base → variants → caller
 * overrides. Synchronous and allocation-light: it runs inside every class
 * effect.
 */
export const mergeClasses = (value: string): string => {
  if (!value) return "";
  const entries: { raw: string; group: ClassGroup | undefined; removed: boolean }[] = [];
  const names = value.split(/\s+/).filter(Boolean);

  if (resolver) {
    const unknown = names.filter((raw) => !groups.has(raw));
    if (unknown.length) {
      const resolved = resolver(unknown);
      if (resolved) {
        useClassGroups(resolved);
        // A class the engine has no group for must not be asked about again.
        for (const raw of unknown) if (!groups.has(raw)) groups.set(raw, ["", []]);
      }
    }
  }

  for (const raw of names) {
    const group = groups.get(raw);
    if (group && group[1].length) {
      for (const existing of entries) {
        if (existing.removed || !existing.group || existing.group[0] !== group[0]) continue;
        if (ownsAll(group[1], existing.group[1])) existing.removed = true;
      }
    }
    entries.push({ raw, group, removed: false });
  }

  let out = "";
  for (const entry of entries) {
    if (entry.removed) continue;
    out += out ? ` ${entry.raw}` : entry.raw;
  }
  return out;
};
