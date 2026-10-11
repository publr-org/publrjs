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

// The class BOOK (jit/src/book.zig) replaces both when a page installs it
// (`useClassBook`): every declaration the sheet holds, in one context, has a
// short name (an atom), and every class is the atoms it is made of. A merge
// then answers the names the page writes, as the server's does: a later atom
// in the same context removes an earlier one of the same property, or of a
// longhand it covers. A marker (`group/x`) keeps a name of its own; a class the
// book does not hold is kept as it is. `namesOf` answers the names a class is
// written by, for code that adds or removes one class at a time.

/** The book as the JIT writes it: `[class, marker name, atom ids]` by class id, each atom's
 * `[name, scope, property]`, and each shorthand's `[property, longhand properties]`. */
export type ClassBookData = {
  classes: ReadonlyArray<readonly [string, string, readonly number[]]>;
  atoms: ReadonlyArray<readonly [string, number, number]>;
  covers: ReadonlyArray<readonly [number, readonly number[]]>;
};

type Named = { atom: number } | { marker: number };

type ClassBook = {
  ids: Map<string, number>;
  classAtoms: (readonly number[])[];
  markerNames: string[];
  atomNames: string[];
  scopes: number[];
  properties: number[];
  covers: Map<number, Set<number>>;
  /** A page's name back to what it stands for. */
  named: Map<string, Named>;
};

let book: ClassBook | null = null;

/** Install the page's class book (null removes it). */
export const useClassBook = (data: ClassBookData | null): void => {
  if (data == null) {
    book = null;
    return;
  }

  const next: ClassBook = {
    ids: new Map(),
    classAtoms: [],
    markerNames: [],
    atomNames: [],
    scopes: [],
    properties: [],
    covers: new Map(),
    named: new Map(),
  };

  data.atoms.forEach(([name, scope, property], atom) => {
    next.atomNames.push(name);
    next.scopes.push(scope);
    next.properties.push(property);
    next.named.set(name, { atom });
  });

  data.classes.forEach(([cls, marker, atoms], id) => {
    next.ids.set(cls, id);
    next.classAtoms.push(atoms);
    next.markerNames.push(marker);
    if (marker !== "") next.named.set(marker, { marker: id });
  });

  for (const [property, longhands] of data.covers) next.covers.set(property, new Set(longhands));

  book = next;
};

/** The names a page writes `cls` by: its atoms' or its marker's with a book, else itself. */
export const namesOf = (cls: string): string[] => {
  if (book == null) return [cls];
  const id = book.ids.get(cls);
  if (id === undefined) return [cls];
  if (book.markerNames[id] !== "") return [book.markerNames[id]];
  return book.classAtoms[id].map((atom) => book!.atomNames[atom]);
};

/** `namesOf(cls)` as one class attribute's text. */
export const nameOf = (cls: string): string => namesOf(cls).join(" ");

/** A stack merged with the book: a class, or a name the page wrote, each stands for its
 * atoms or its marker. */
const mergeByBook = (table: ClassBook, tokens: readonly string[]): string => {
  const atoms: number[] = [];
  const removed: boolean[] = [];
  const markers: number[] = [];
  const raw: string[] = [];

  const add = (atom: number) => {
    const scope = table.scopes[atom];
    const property = table.properties[atom];
    const longhands = table.covers.get(property);

    for (let at = 0; at < atoms.length; at++) {
      if (removed[at]) continue;
      const earlier = atoms[at];
      if (earlier === atom) return;
      if (table.scopes[earlier] !== scope) continue;
      const other = table.properties[earlier];
      if (other === property || longhands?.has(other)) removed[at] = true;
    }

    atoms.push(atom);
    removed.push(false);
  };

  for (const token of tokens) {
    const id = table.ids.get(token);
    const named: Named | undefined = id === undefined ? table.named.get(token) : undefined;

    if (id !== undefined && table.markerNames[id] === "") {
      for (const atom of table.classAtoms[id]) add(atom);
    } else if (id !== undefined || (named && "marker" in named)) {
      const marker = id ?? (named as { marker: number }).marker;
      if (!markers.includes(marker)) markers.push(marker);
    } else if (named && "atom" in named) {
      add(named.atom);
    } else {
      raw.push(token);
    }
  }

  const written = atoms.filter((_, at) => !removed[at]).map((atom) => table.atomNames[atom]);
  for (const marker of markers) written.push(table.markerNames[marker]);

  return [...written, ...raw].join(" ");
};

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

  if (book != null) return mergeByBook(book, names);

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
