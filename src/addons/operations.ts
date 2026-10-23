// Publr's operations from the browser: `call` writes through one, `query` reads one or a GROQ
// query, reactively. On an admin page they go to `/api/<plugin>.<verb>` with the page's
// token; inside a plugin's frame, where there is no session, through the frame's bridge to
// the admin, which runs only the plugin's own operations, as the person looking. There a
// view reads them from its `ctx` (`Publr.ctx`): `ctx.query(name, input)`, `ctx.call(name)`.
// Through the core entry, so the core stays one file (dist/publr.js) for every addon.
import { awaited, mutation, Publr } from "../publr";
import type { AwaitedResult } from "../intrinsics";
import type { MutationResult } from "../core/mutation";
import { browserCache } from "../core/query-cache";
import { url as underBase } from "../core/base";

/** Who is looking at a plugin's page, and the page: its path among the plugin's pages and
 * its query string. */
export type Person = { name: string; email: string };
export type Page = { path: string; query: string };

/** The frame's bridge (`window.publr`), present only inside a plugin's frame. */
type Bridge = {
  person: Person;
  page: Page;
  send(operation: string, input: unknown): Promise<unknown>;
  navigate(path: string): void;
};

/** Every operation a page may name, with its input and output: filled in by each plugin's
 * generated `ui/operations.d.ts` (`publr plugin build`), so names and fields are checked. */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Operations {}

type Named = keyof Operations & string;
type InOf<K> = K extends Named ? (Operations[K] extends { in: infer I } ? I : unknown) : unknown;
type OutOf<K> = K extends Named ? (Operations[K] extends { out: infer O } ? O : unknown) : unknown;

/** A GROQ query, marked so `query` reads it through `record.query`. */
export type Groq = { readonly groq: string };

/** `groq\`*[_type == "chapter"]\``: a GROQ query for `query`. */
export function groq(strings: TemplateStringsArray, ...values: unknown[]): Groq {
  return { groq: String.raw({ raw: strings }, ...values) };
}

/** Every read refetches after any write: what a write changed is the server's to know. */
const written = "operations";

const bridge = (): Bridge | undefined => (globalThis as unknown as { publr?: Bridge }).publr;

const csrf = (): string =>
  document.querySelector('meta[name="publr-csrf"]')?.getAttribute("content") ?? "";

/** One thing wrong with a call's input, beside its field. */
export type Problem = { field: string; message: string };

/** A refused call: `code` is the answer's `error` (`Invalid`, `NotEnoughStock`), `problems`
 * says what was wrong with each field when the input was refused. */
export class Refused extends Error {
  readonly code: string;
  readonly problems: Problem[];
  constructor(code: string, message: string, problems: Problem[] = []) {
    super(message);
    this.name = "Refused";
    this.code = code;
    this.problems = problems;
  }
}

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(underBase(path), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Csrf-Token": csrf() },
    body: JSON.stringify(body ?? {}),
  });
  const answer = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    problems?: Problem[];
  };
  if (!response.ok) {
    const problems = Array.isArray(answer.problems) ? answer.problems : [];
    const told = answer.message ?? problems.map((problem) => problem.message).join(" ");
    throw new Refused(
      answer.error ?? "Refused",
      told || answer.error || `refused (${response.status})`,
      problems,
    );
  }
  return answer;
}

/** Runs one operation by name with its input, wherever the page is. */
export function send(operation: string, input: unknown): Promise<unknown> {
  const via = bridge();
  if (via) return via.send(operation, input);
  if (operation.indexOf(".") <= 0) return Promise.reject(new Error(`publr: "${operation}" is not an operation name`));
  return post(`/api/${operation}`, input);
}

/** Reads a GROQ query as the person (`record.query`); a plugin's frame reads its own
 * operations instead. */
function read(query: Groq, params: unknown): Promise<unknown> {
  const input = { query: query.groq, params: JSON.stringify(params ?? {}), perspective: "all" };
  return send("record.query", input).then((answer) => (answer as { result: unknown }).result);
}

/** A write through one operation (or one named when it runs, `() => state.save`), called
 * with its input: `save(input)`; it also carries
 * `isPending`, `error` and `value`. Every read on the page refetches once it succeeds. */
export function call<K extends Named | (string & {})>(
  operation: K | (() => K),
): MutationResult<[input: InOf<K>], OutOf<K>> {
  return mutation(async (input: InOf<K>) => {
    const named = typeof operation === "function" ? operation() : operation;
    const output = (await send(named, input)) as OutOf<K>;
    browserCache.invalidate(written);
    return output;
  });
}

export interface QueryOptions<T> {
  /** The first value, when the page has it as data. */
  initial?: T;
  /** The page's server render already drew the first value: read nothing on load, only
   * once a write makes it stale. */
  seeded?: boolean;
}

/** A reactive read of one operation, or of a GROQ query: `value`, `isPending`, `error`,
 * `refresh()`. Its input (or the query's params) is a function, so a read follows the state
 * it uses; it refetches after any write through `call`. */
export function query<K extends Named>(
  source: K,
  input?: () => InOf<K>,
  options?: QueryOptions<OutOf<K>>,
): AwaitedResult<OutOf<K>>;
export function query<T = unknown>(
  source: string | Groq,
  input?: () => unknown,
  options?: QueryOptions<T>,
): AwaitedResult<T>;
export function query<T>(
  source: string | Groq,
  input?: () => unknown,
  options: QueryOptions<T> = {},
): AwaitedResult<T> {
  const asked = () => (input ? input() : {});
  let waiting = options.seeded === true;
  const run = () => {
    const parameters = asked();
    if (waiting) {
      waiting = false;
      return Promise.resolve(options.initial as T);
    }
    return (
      typeof source === "string" ? send(source, parameters) : read(source, parameters)
    ) as Promise<T>;
  };
  const name = typeof source === "string" ? source : source.groq;
  const { seeded: _seeded, ...rest } = options;
  return awaited(run, {
    ...rest,
    key: () => [name, asked()],
    // Kept until a write invalidates it; the ttl only bounds a page left open.
    cache: { ttl: 300_000, tags: [written] },
  });
}

/** A view's `ctx` in the browser, as its props carry it on the server. */
export type ViewCtx = {
  person: Person;
  page: Page;
  query: typeof query;
  call: typeof call;
  navigate(path: string): void;
};

const framed = bridge();
if (framed) {
  const ctx: ViewCtx = {
    person: framed.person,
    page: framed.page,
    query,
    call,
    navigate: (path) => framed.navigate(path),
  };
  Publr.ctx = ctx;
}
