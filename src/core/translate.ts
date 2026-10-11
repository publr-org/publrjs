// `Publr.t`, `Publr.tn`, `Publr.tx` in the browser: the message in the reader's language,
// from the catalogue the page loads (`globalThis.__publr_messages`, set by the host's
// script), else the source text, with its `{name}` placeholders filled. The plural rules are
// the server's, form for form.

type Catalogue = { rule: string; messages: Record<string, string[]> };
type Values = Record<string, string | number>;

const catalogue = (): Catalogue | null =>
  (globalThis as unknown as { __publr_messages?: Catalogue }).__publr_messages ?? null;

const few = (n: number) => n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);

/** The form a count takes, in gettext's order, by the catalogue's rule. */
function formOf(rule: string, n: number): number {
  const last = n % 10;
  const two = n % 100;
  switch (rule) {
    case "single":
      return 0;
    case "zero_one_other":
      return n <= 1 ? 0 : 1;
    case "polish":
      return n === 1 ? 0 : few(n) ? 1 : 2;
    case "east_slavic":
      return last === 1 && two !== 11 ? 0 : few(n) ? 1 : 2;
    case "czech":
      return n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;
    case "slovenian":
      return two === 1 ? 0 : two === 2 ? 1 : two === 3 || two === 4 ? 2 : 3;
    case "lithuanian":
      return last === 1 && (two < 11 || two > 19) ? 0 : last >= 2 && (two < 11 || two > 19) ? 1 : 2;
    case "latvian":
      return last === 1 && two !== 11 ? 0 : n !== 0 ? 1 : 2;
    case "romanian":
      return n === 1 ? 0 : n === 0 || (two >= 1 && two <= 19) ? 1 : 2;
    case "arabic":
      return n === 0
        ? 0
        : n === 1
          ? 1
          : n === 2
            ? 2
            : two >= 3 && two <= 10
              ? 3
              : two >= 11
                ? 4
                : 5;
    default:
      return n === 1 ? 0 : 1;
  }
}

/** The `}` closing the `{` at `open`, counting nested ones. */
function matching(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "{") depth++;
    if (text[index] === "}" && --depth === 0) return index;
  }
  return -1;
}

/** The arm of `name, select, key {text} … other {text}` that `value` names, else `other`'s. */
function armOf(rest: string, value: string | undefined): string {
  let fallback = "";
  for (let open = rest.indexOf("{"); open >= 0; open = rest.indexOf("{")) {
    const key = rest.slice(0, open).trim();
    const close = matching(rest, open);
    if (close < 0) break;
    const arm = rest.slice(open + 1, close);
    if (value !== undefined && key === value) return arm;
    if (key === "other") fallback = arm;
    rest = rest.slice(close + 1);
  }
  return fallback;
}

/** `{name}` filled, `{count}` too, and `{name, select, a {…} other {…}}` by the arm the
 * value names; an unknown name stays as written. As the server does, form for form. */
function fill(
  text: string,
  values: Values | undefined,
  count: number | undefined,
  depth = 0,
): string {
  if (depth === 4 || text.indexOf("{") < 0) return text;
  const valueOf = (name: string): string | undefined => {
    if (values && name in values) return String(values[name]);
    if (name === "count" && count !== undefined) return String(count);
    return undefined;
  };
  let out = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{", index);
    const close = open < 0 ? -1 : matching(text, open);
    if (open < 0 || close < 0) return out + text.slice(index);
    out += text.slice(index, open);
    const inner = text.slice(open + 1, close);
    const at = inner.indexOf(", select,");
    const written =
      at >= 0
        ? fill(
            armOf(inner.slice(at + ", select,".length), valueOf(inner.slice(0, at))),
            values,
            count,
            depth + 1,
          )
        : valueOf(inner);
    out += written ?? text.slice(open, close + 1);
    index = close + 1;
  }
  return out;
}

function lookup(context: string, id: string, count: number | undefined): string | null {
  const found = catalogue();
  if (!found) return null;
  const forms = found.messages[context === "" ? id : `${context}\u0004${id}`];
  if (!forms) return null;
  const whole = count !== undefined && Number.isInteger(count) && count >= 0;
  const index = count === undefined ? 0 : whole ? formOf(found.rule, count) : forms.length - 1;
  return forms[index] ?? null;
}

/** The message as the reader reads it. */
export function t(id: string, values?: Values): string {
  return fill(lookup("", id, undefined) ?? id, values, undefined);
}

/** The message meant in `context` (`"verb"` for "Post"). */
export function tx(context: string, id: string, values?: Values): string {
  return fill(lookup(context, id, undefined) ?? id, values, undefined);
}

/** The message for `count` of something: `tn("{count} file", "{count} files", n)`. */
export function tn(one: string, other: string, count: number, values?: Values): string {
  const source = count === 1 ? one : other;
  return fill(lookup("", one, count) ?? source, values, count);
}
