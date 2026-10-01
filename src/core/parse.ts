// Pure parsing/path utilities for the data-p-* wire syntax (grammar v2 — the
// wire IS the authoring syntax, byte-identical to ZSX sources). No runtime
// state — safe to import from anywhere.

/**
 * The one wire tokenizer: split `s` on any of `delims` (checked in array
 * order, so longer tokens go first where prefixes overlap: `>=` before `>`)
 * at most `limit` times. Never splits inside quoted literals ('…' or "…") or
 * inside […]/{…}/(…) at depth 0, so arbitrary-value classes like
 * `grid-cols-[repeat(2,minmax(0,1fr))]`, match blocks, and quoted payloads
 * containing delimiters, and parenthesized nested specs, travel as single
 * segments. The delimiter check runs
 * BEFORE bracket tracking, so `{` / `}` themselves work as delimiters (the
 * match-form parser splits on them).
 */
export const scan = (s: string, delims: string[], limit = Infinity): string[] => {
  const out: string[] = [];
  let quote: string | null = null;
  let depth = 0;
  let start = 0;
  let i = 0;

  outer: while (i < s.length) {
    const ch = s[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      }
    } else {
      if (!depth && out.length < limit) {
        for (const d of delims) {
          if (s.startsWith(d, i)) {
            out.push(s.slice(start, i));
            i += d.length;
            start = i;
            continue outer;
          }
        }
      }

      if (ch === "'" || ch === '"') {
        quote = ch;
      } else if (ch === "[" || ch === "{" || ch === "(") {
        depth++;
      } else if ((ch === "]" || ch === "}" || ch === ")") && depth) {
        depth--;
      }
    }

    i++;
  }

  out.push(s.slice(start));
  return out;
};

// Strip the `$` state-ref sigil, if present — the ONE wire spelling (identical
// to ZSX sources). Bare refs (loop vars, action names, plain paths) carry no
// sigil and pass through.
export const stripStatePrefix = (path: string): string => (path[0] === "$" ? path.slice(1) : path);

export const resolvePath = (root: any, path: string): any =>
  path
    .trim()
    .split(".")
    .reduce((obj, key) => obj?.[key], root);

// `;`-separated entries, each split on the FIRST `separator` — both splits go
// through the tokenizer, so quoted/bracketed payloads may contain either
// delimiter (this is what fixes the old wireBind `;` limitation).
export const parseBindings = (value: string | null, separator: string): Array<[string, string]> => {
  const bindings: Array<[string, string]> = [];

  if (value) {
    for (const part of scan(value, [";"])) {
      const [lhs, rhs] = scan(part, [separator], 1);

      if (rhs != null && lhs.trim() && rhs.trim()) {
        bindings.push([lhs.trim(), rhs.trim()]);
      }
    }
  }

  return bindings;
};

// A quoted string literal ('…' or "…") → its contents; null when `s` is not
// a (fully) quoted literal.
export const unquoteLiteral = (s: string): string | null => {
  const m = /^\s*(['"])([^]*)\1\s*$/.exec(s);

  return m && m[2];
};

// Predicate ops, longest-first so `>=`/`<=` win over `>`/`<`. `contains`
// needs the surrounding spaces to stay a word (dotted paths have none).
const OPS = ["==", "!=", ">=", "<=", ">", "<", " contains "];

/** A parsed predicate: [ref, negate, op?, literal?]. */
export type Predicate = [ref: string, negate: boolean, op?: string, literal?: string];

// predicate := ['not'] ref [op literal] — the op split is tokenized, so a
// quoted literal may contain op characters (`$title == 'a > b'`); the real op
// always precedes the literal, so first-match-wins is safe.
export const parsePredicate = (spec: string): Predicate => {
  let s = spec.trim();
  const negate = /^not\s/.test(s);

  if (negate) {
    s = s.slice(4).trim();
  }

  for (const op of OPS) {
    const [ref, lit] = scan(s, [op], 1);

    if (lit != null) {
      return [ref.trim(), negate, op, unquoteLiteral(lit) ?? lit.trim()];
    }
  }

  return [s, negate];
};

/**
 * Evaluate `value <op> literal`. ==/!= compare stringified, the ordered ops
 * compare numerically (NaN → false), `contains` is duck-typed `includes` —
 * one impl covers arrays and strings.
 */
export const evaluatePredicate = (value: unknown, op: string, literal: string): boolean => {
  // Number(value), not unary +: user state may hold BigInt (+ would throw).
  const n = Number(value);
  const m = +literal;

  return op === "=="
    ? String(value) === literal
    : op === "!="
      ? String(value) !== literal
      : op === ">"
        ? n > m
        : op === "<"
          ? n < m
          : op === ">="
            ? n >= m
            : op === "<="
              ? n <= m
              : ((value as any)?.includes?.(literal) ?? false);
};

/** A parsed match group: [discriminant, arms, template?]. */
export type Match = [
  discriminant: string,
  arms: Array<[key: string, payload: string]>,
  template: string | null,
];

// group := ref '{' arm+ '}' ['=>' '{' template '}'] — null when the group has
// no match block. A `{` that opens a `{$…}` hole is NOT a block opener (that
// group is a bare interpolation pattern); the compiler enforces the same rule.
export const parseMatch = (group: string): Match | null => {
  const [head, blockRest] = scan(group, ["{"], 1);

  if (blockRest == null || /^\$[^}]*\}/.test(blockRest)) {
    return null;
  }

  const [armsText, tail] = scan(blockRest, ["}"], 1);
  const arms: Match[1] = [];

  // arm := (literal | '_') ':' payload — ',' or newline separated; the
  // key split is tokenized too, so quoted keys may contain ':' or ','.
  for (const arm of scan(armsText, [",", "\n"])) {
    const [keyRaw, payload] = scan(arm, [":"], 1);

    if (payload != null && keyRaw.trim()) {
      arms.push([unquoteLiteral(keyRaw) ?? keyRaw.trim(), payload.trim()]);
    }
  }

  let template: string | null = null;
  const after = (tail ?? "").trim();

  if (after.startsWith("=>")) {
    template = scan(scan(after, ["{"], 1)[1] ?? "", ["}"], 1)[0];
  }

  return [head.trim(), arms, template];
};

/**
 * The shared match evaluator (class, text, and bind all route through it):
 * keys `true`/`false` test truthiness/falsiness of the value, `_` is the
 * default, every other key tests `String(value) === key`. Undefined when
 * nothing matches and there is no default.
 */
export const matchArm = (arms: Array<[string, string]>, value: unknown): string | undefined => {
  let fallback: string | undefined;

  for (const [key, payload] of arms) {
    if (key === "_") {
      fallback = payload;
    } else if (key === "true" ? value : key === "false" ? !value : String(value) === key) {
      return payload;
    }
  }

  return fallback;
};
