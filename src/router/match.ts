import type { RouteDefinition, RouteMatch } from "../core/types";

interface Branch<TMeta> {
  chain: RouteDefinition<TMeta>[];
  pattern: string;
}

const trim = (path: string): string => path.replace(/^\/+|\/+$/g, "");

const join = (parent: string, child: string): string => {
  if (child.startsWith("/")) return `/${trim(child)}`;
  const joined = [trim(parent), trim(child)].filter(Boolean).join("/");
  return joined ? `/${joined}` : "/";
};

function branches<TMeta>(
  routes: RouteDefinition<TMeta>[],
  parent = "/",
  ancestors: RouteDefinition<TMeta>[] = [],
): Branch<TMeta>[] {
  const out: Branch<TMeta>[] = [];

  for (const route of routes) {
    const pattern = join(parent, route.path);
    const chain = [...ancestors, route];

    if (route.children?.length) {
      out.push(...branches(route.children, pattern, chain));
    }

    out.push({ chain, pattern });
  }

  return out;
}

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  const segments = trim(pattern).split("/").filter(Boolean);
  let source = "^";

  if (!segments.length) source += "/";

  for (const [index, segment] of segments.entries()) {
    source += "/";

    if (segment === "*" || segment.startsWith("*")) {
      if (index !== segments.length - 1) {
        throw new Error(`Publr.router: wildcard must be the final segment in "${pattern}".`);
      }

      names.push(segment.slice(1) || "*");
      source = `${source.slice(0, -1)}(?:/(.*))?`;
    } else if (segment.startsWith(":")) {
      const name = segment.slice(1);
      if (!name) throw new Error(`Publr.router: unnamed parameter in "${pattern}".`);
      names.push(name);
      source += "([^/]+)";
    } else {
      source += escape(segment);
    }
  }

  return { regex: new RegExp(`${source}/?$`), names };
}

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Match an application pathname. Pure and DOM-free for browser/server reuse. */
export function matchRoutes<TMeta = unknown>(
  routes: RouteDefinition<TMeta>[],
  pathname: string,
): RouteMatch<TMeta>[] {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  for (const branch of branches(routes)) {
    const { regex, names } = compile(branch.pattern);
    const result = regex.exec(normalized);
    if (!result) continue;

    const params: Record<string, string> = {};
    names.forEach((name, index) => (params[name] = decode(result[index + 1] ?? "")));

    return branch.chain.map((route) => ({
      id: route.id,
      path: branch.pattern,
      params: { ...params },
      meta: route.meta,
      route,
    }));
  }

  return [];
}
