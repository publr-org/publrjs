/**
 * The path the page's project is served under (`/environments/dev`), stated once by the
 * server as `<html data-publr-base>`; empty at the root. A root path the page binds into a
 * URL attribute, or builds for `fetch`, goes under it, the way the server wrote its own.
 */
export const urlAttributes: ReadonlySet<string> = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "poster",
]);

export const basePath = (): string =>
  globalThis.document?.documentElement?.getAttribute("data-publr-base") ?? "";

/** Whether a root path lacks `base`: never another host (`//…`), a full address, a
 * fragment, or a path already at or under it. */
export const needsBase = (base: string, value: string): boolean => {
  if (base === "" || !value.startsWith("/") || value.startsWith("//")) return false;
  if (!value.startsWith(base)) return true;

  const rest = value.slice(base.length);

  return !(rest === "" || rest[0] === "/" || rest[0] === "?" || rest[0] === "#");
};

/** `path` under the page's base: `Publr.url("/api/records")`. */
export const url = (path: string): string => {
  const base = basePath();

  return needsBase(base, path) ? base + path : path;
};

/** A path the browser shows (`location.pathname`) without the page's base, as the site
 * names it: `/environments/dev/admin` is `/admin`. Anything outside the base as it is. */
export const path = (address: string): string => {
  const base = basePath();

  if (base === "" || !address.startsWith(base)) return address;

  const rest = address.slice(base.length);

  if (rest === "") return "/";

  return rest[0] === "/" || rest[0] === "?" || rest[0] === "#" ? rest : address;
};
