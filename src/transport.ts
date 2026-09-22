import { operationSignal } from "./core/operation-context";
// Generated native stubs own transport details. Authority comes from the request.
import { httpPolicy } from "./core/http-policy";
import { operationResult, type OperationResult, type ResultPolicy } from "./core/query-cache";

export type OperationObserver = (
  endpoint: string,
  args: readonly unknown[],
) => (response?: Response, error?: unknown) => void;
const observers = new Set<OperationObserver>();
/** Opt-in transport telemetry. Does not replace fetch or reinterpret application data. */
export function observeOperations(observer: OperationObserver): () => void {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
}

export type ResponseAdapter = (
  response: Response,
  body: unknown,
) => {
  value: unknown;
  policy?: ResultPolicy;
};
const adapters = new Map<string, ResponseAdapter>();

/** Configure once at an API boundary. Ordinary decoded payload fields have no policy meaning. */
export function registerResponseAdapter(endpoint: string, adapter: ResponseAdapter): () => void {
  if (adapters.has(endpoint)) throw new Error("publr: response adapter already registered");
  adapters.set(endpoint, adapter);
  return () => {
    if (adapters.get(endpoint) === adapter) adapters.delete(endpoint);
  };
}

export async function operation<T>(endpoint: string, args: unknown[]): Promise<OperationResult<T>> {
  const body = JSON.stringify(args, (_key, value: unknown) => {
    if (
      value === undefined ||
      typeof value === "function" ||
      typeof value === "symbol" ||
      typeof value === "bigint" ||
      (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0)))
    )
      throw new Error("publr: native arguments must be transferable JSON values");
    return value;
  });
  const requestedAt = Date.now();
  const completed = [...observers].flatMap((observe) => {
    try {
      return [observe(endpoint, args)];
    } catch {
      return [];
    }
  });
  const report = (response?: Response, error?: unknown) => {
    for (const finish of completed) {
      try {
        finish(response?.clone(), error);
      } catch {
        /* Telemetry cannot change the operation. */
      }
    }
  };
  const response = await fetch(endpoint, {
    signal: operationSignal(),
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body,
  }).then(
    (response) => {
      report(response);
      return response;
    },
    (error: unknown) => {
      report(undefined, error);
      throw error;
    },
  );
  if (!response.ok) throw new Error(`Native operation failed (${response.status})`);
  const receivedAt = Date.now();
  const policy = httpPolicy(response, requestedAt, receivedAt);
  // POST retention has no request-header variant key. Delegate varying responses to the origin.
  if (response.headers.get("Vary")?.trim()) policy.noStore = true;
  // Cross-origin policy/validator/Vary fields may be hidden by CORS. Do not infer permission.
  if (
    typeof location !== "undefined" &&
    new URL(endpoint, location.href).origin !== location.origin
  )
    policy.noStore = true;
  const decoded: unknown = await response.json();
  const adapted = adapters.get(endpoint)?.(response, decoded);
  return operationResult((adapted ? adapted.value : decoded) as T, {
    ...policy,
    ...adapted?.policy,
    noStore: policy.noStore || adapted?.policy?.noStore,
    revalidate: policy.revalidate || adapted?.policy?.revalidate,
    expires:
      policy.expires === undefined
        ? adapted?.policy?.expires
        : Math.min(policy.expires, adapted?.policy?.expires ?? Infinity),
    tags: [...new Set([...(policy.tags ?? []), ...(adapted?.policy?.tags ?? [])])],
  });
}

/** GET integration delegates freshness, Vary, validators and 304 merging to Fetch's HTTP cache. */
export function httpOperation<T>(
  url: string | URL,
  options: {
    headers?: HeadersInit;
    credentials?: RequestCredentials;
    adapter?: ResponseAdapter;
  } = {},
): () => Promise<OperationResult<T>> {
  return async () => {
    const requestedAt = Date.now();
    const response = await fetch(url, {
      signal: operationSignal(),
      method: "GET",
      headers: options.headers,
      credentials: options.credentials ?? "same-origin",
      cache: "no-cache",
    });
    if (!response.ok) throw new Error(`HTTP operation failed (${response.status})`);
    const policy = httpPolicy(response, requestedAt, Date.now());
    // Use the platform cache for GET reuse. Each awaited refresh validates through it.
    policy.revalidate = true;
    const decoded: unknown = await response.json();
    const adapted = options.adapter?.(response, decoded);
    return operationResult((adapted ? adapted.value : decoded) as T, {
      ...adapted?.policy,
      ...policy,
      noStore: policy.noStore || adapted?.policy?.noStore,
      tags: [...new Set([...(policy.tags ?? []), ...(adapted?.policy?.tags ?? [])])],
    });
  };
}
