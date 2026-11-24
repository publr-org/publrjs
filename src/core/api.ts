/**
 * Publr's REST API from the browser: the one place a page calls an operation by name.
 * `/api/<operation>` answers `{ result, meta }`: the operation's answer, and what is about
 * the call itself (`meta.next`, the page after this one, for an operation answering a page
 * at a time). A change to that shape is made here, and every caller follows.
 */
import { url } from "./base";

/** One thing wrong with a call's input, beside its field. */
export type Problem = { field: string; message: string };

/** What is about a call itself: `next` for an operation answering a page at a time. */
export type Meta = { next?: string; [told: string]: unknown };

/** A call's whole answer: the operation's own, and what is about the call. */
export type Answered<T = unknown> = { result: T; meta: Meta };

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

const csrf = (): string =>
  globalThis.document?.querySelector('meta[name="publr-csrf"]')?.getAttribute("content") ?? "";

/** What a caller may add to a call: headers beside the API's own, the session's CSRF token
 * when the page holds no `publr-csrf` meta, and a look at the response as it arrives. */
export type CallOptions = {
  headers?: Record<string, string>;
  csrf?: string;
  response?: (response: Response) => void;
};

/** The operation called with `input`, its whole answer: `result` and `meta`. */
export async function answered<T = unknown>(
  operation: string,
  input: unknown,
  options: CallOptions = {},
): Promise<Answered<T>> {
  if (operation.indexOf(".") <= 0)
    throw new Error(`publr: "${operation}" is not an operation name`);
  const response = await fetch(url(`/api/${operation}`), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      "X-Csrf-Token": options.csrf || csrf(),
    },
    body: JSON.stringify(input ?? {}),
  });
  options.response?.(response);
  const answer = (await response.json().catch(() => ({}))) as {
    result?: T;
    meta?: Meta;
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
  return { result: answer.result as T, meta: answer.meta ?? {} };
}

/** The operation called with `input`: its answer. */
export async function send<T = unknown>(
  operation: string,
  input: unknown,
  options: CallOptions = {},
): Promise<T> {
  return (await answered<T>(operation, input, options)).result;
}

/** Every page of an operation answering a page at a time, one after another:
 * `for await (const page of Publr.pages("operation.list", {}))`. */
export async function* pages<T = unknown>(
  operation: string,
  input: Record<string, unknown> = {},
): AsyncGenerator<T> {
  let after = "";
  for (;;) {
    const page: Answered<T> = await answered<T>(operation, after ? { ...input, after } : input);
    yield page.result;
    const next = page.meta.next ?? "";
    if (!next || next === after) return;
    after = next;
  }
}
