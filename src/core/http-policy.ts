import type { ResultPolicy } from "./query-cache";

/** Private awaited retention, not a general HTTP cache or POST/CDN policy. */
export function httpPolicy(
  response: Response,
  requestedAt: number,
  receivedAt: number,
  shared = false,
): ResultPolicy {
  const directives = new Map<string, string | undefined>();
  const duplicate = new Set<string>();
  for (const part of response.headers.get("Cache-Control")?.match(/(?:[^,"]|"[^"]*")+/g) ?? []) {
    const [rawName, ...rest] = part.trim().split("=");
    const name = rawName.toLowerCase();
    if (directives.has(name)) duplicate.add(name);
    directives.set(name, rest.length ? rest.join("=").trim().replace(/^"|"$/g, "") : undefined);
  }
  const noStore =
    directives.has("no-store") ||
    (shared && directives.has("private")) ||
    response.headers
      .get("Vary")
      ?.split(",")
      .some((name) => name.trim() === "*") ||
    response.type === "opaque";
  const seconds = (value: string | null | undefined) =>
    value != null && /^\d+$/.test(value) ? Math.min(Number(value), 2147483648) * 1000 : undefined;
  const date = Date.parse(response.headers.get("Date") ?? "");
  const expires = Date.parse(response.headers.get("Expires") ?? "");
  const freshnessName = shared && directives.has("s-maxage") ? "s-maxage" : "max-age";
  const lifetime = duplicate.has(freshnessName)
    ? 0
    : directives.has(freshnessName)
      ? (seconds(directives.get(freshnessName)) ?? 0)
      : Number.isFinite(expires)
        ? Math.max(0, expires - (Number.isFinite(date) ? date : receivedAt))
        : undefined;
  const ageHeader = response.headers.get("Age");
  const age = ageHeader == null ? 0 : (seconds(ageHeader) ?? Infinity);
  const currentAge = Math.max(
    Number.isFinite(date) ? Math.max(0, receivedAt - date) : 0,
    age + Math.max(0, receivedAt - requestedAt),
  );
  let tags: string[] | undefined;
  const dependencyHeader = response.headers.get("Publr-Dependencies");
  if (dependencyHeader) {
    const decoded: unknown = JSON.parse(dependencyHeader);
    if (!Array.isArray(decoded) || !decoded.every((value) => typeof value === "string"))
      throw new Error("publr: invalid Publr-Dependencies header");
    tags = decoded;
  }
  const rawRevision = response.headers.get("Publr-Revision");
  const revision = rawRevision === null ? undefined : Number(rawRevision);
  if (revision !== undefined && (!/^\d+$/.test(rawRevision!) || !Number.isSafeInteger(revision)))
    throw new Error("publr: invalid Publr-Revision header");
  return {
    revision,
    noStore: !!noStore,
    revalidate:
      directives.has("no-cache") ||
      (!directives.size && response.headers.get("Pragma")?.toLowerCase().includes("no-cache")) ||
      false,
    expires: lifetime === undefined ? undefined : receivedAt + Math.max(0, lifetime - currentAge),
    tags,
  };
}
