// PublrJS browser router addon. It owns URL state and navigation, while
// rendering remains application-controlled through the reactive `current` object.

import { Publr } from "../publr";
import type {
  NavigateOptions,
  RouteLoadContext,
  RouteMatch,
  Router,
  RouterOptions,
  ScrollPolicy,
} from "../core/types";
import { matchRoutes } from "../router/match";

const ROUTER_STATE = "__publrRouter";

interface ScrollSnapshot {
  window: [number, number];
  regions: Record<string, [number, number]>;
}

const newKey = (): string => Publr.randomId();

function stateWithKey(state: unknown, key: string): Record<string, unknown> {
  const base = state && typeof state === "object" ? state : { user: state };
  return { ...base, [ROUTER_STATE]: { key } };
}

function historyKey(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return;
  const value = (state as Record<string, any>)[ROUTER_STATE];
  return typeof value?.key === "string" ? value.key : undefined;
}

function isAbort(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { name?: string }).name === "AbortError";
}

export function createRouter<TMeta = unknown>(options: RouterOptions<TMeta>): Router<TMeta> {
  const hasBrowser = typeof window !== "undefined" && typeof location !== "undefined";
  const base = `/${(options.base ?? "").replace(/^\/+|\/+$/g, "")}`;
  const initialUrl = new URL(hasBrowser ? location.href : "http://localhost/");

  const routePath = (url: URL): string | null => {
    if (base === "/") return url.pathname;
    if (url.pathname === base) return "/";
    return url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : null;
  };

  const matchesFor = (url: URL): RouteMatch<TMeta>[] => {
    const path = routePath(url);
    return path == null ? [] : matchRoutes(options.routes, path);
  };

  const initialMatches = matchesFor(initialUrl);
  const current = Publr.reactive({
    url: initialUrl,
    pathname: initialUrl.pathname,
    params: initialMatches.at(-1)?.params ?? {},
    search: initialUrl.searchParams,
    hash: initialUrl.hash,
    matches: initialMatches,
    status: "idle" as "idle" | "loading" | "ready" | "error",
    error: null as unknown,
  });

  const scrollPositions = new Map<string, ScrollSnapshot>();
  let currentKey = hasBrowser ? historyKey(history.state) : undefined;
  let controller: AbortController | null = null;
  let navigation = 0;
  let started = false;
  let pendingScroll: { policy: ScrollPolicy; key: string } | null = null;

  if (hasBrowser && !currentKey) {
    currentKey = newKey();
    history.replaceState(stateWithKey(history.state, currentKey), "", location.href);
  }

  function snapshot(): ScrollSnapshot {
    const regions: Record<string, [number, number]> = {};

    if (typeof document !== "undefined") {
      for (const element of document.querySelectorAll<HTMLElement>("[data-p-scroll]")) {
        const name = element.dataset.pScroll;
        if (name) regions[name] = [element.scrollLeft, element.scrollTop];
      }
    }

    return {
      window: hasBrowser ? [window.scrollX || 0, window.scrollY || 0] : [0, 0],
      regions,
    };
  }

  function recordScroll(): void {
    if (currentKey) scrollPositions.set(currentKey, snapshot());
  }

  function applyScroll(policy: ScrollPolicy, key: string): void {
    if (!hasBrowser || policy === "preserve") return;
    const saved = policy === "restore" ? scrollPositions.get(key) : undefined;
    const windowPosition = saved?.window ?? [0, 0];
    window.scrollTo?.(windowPosition[0], windowPosition[1]);

    for (const element of document.querySelectorAll<HTMLElement>("[data-p-scroll]")) {
      const position = saved?.regions[element.dataset.pScroll ?? ""] ?? [0, 0];
      element.scrollLeft = position[0];
      element.scrollTop = position[1];
    }
  }

  function commit(): void {
    if (!pendingScroll) return;
    const pending = pendingScroll;
    pendingScroll = null;
    applyScroll(pending.policy, pending.key);
  }

  async function runLoaders(
    url: URL,
    matches: RouteMatch<TMeta>[],
    signal: AbortSignal,
  ): Promise<unknown[]> {
    const params = matches.at(-1)?.params ?? {};
    return Promise.all(
      matches.map((match) => {
        if (!match.route.load) return undefined;
        const ctx: RouteLoadContext<TMeta> = {
          url,
          params,
          search: url.searchParams,
          signal,
          match,
          matches,
        };
        return match.route.load(ctx);
      }),
    );
  }

  async function transition(
    href: string | URL,
    mode: "push" | "replace" | "none",
    navOptions: NavigateOptions = {},
    isPop = false,
  ): Promise<void> {
    const url = new URL(String(href), hasBrowser ? location.href : initialUrl);
    if (hasBrowser && url.origin !== location.origin) {
      throw new Error(`Publr.router cannot navigate to a different origin: ${url.origin}`);
    }

    const matches = matchesFor(url);
    const myNavigation = ++navigation;
    pendingScroll = null;
    controller?.abort();
    controller = new AbortController();
    const navigationController = controller;

    if (hasBrowser && mode !== "none") {
      recordScroll();
      const key = mode === "replace" ? currentKey! : newKey();
      const state = stateWithKey(
        navOptions.state ?? (mode === "replace" ? history.state : null),
        key,
      );
      history[mode === "push" ? "pushState" : "replaceState"](state, "", url);
      currentKey = key;
    } else if (hasBrowser && isPop) {
      currentKey = historyKey(history.state) ?? newKey();
    }

    const params = matches.at(-1)?.params ?? {};
    current.url = url;
    current.pathname = url.pathname;
    current.params = params;
    current.search = url.searchParams;
    current.hash = url.hash;
    current.matches = matches;
    current.error = null;
    current.status = "loading";

    try {
      await runLoaders(url, matches, navigationController.signal);
      if (myNavigation !== navigation || navigationController.signal.aborted) return;
      current.status = "ready";
      const routePolicy = matches.at(-1)?.route.scroll;
      const policy =
        navOptions.scroll ?? routePolicy ?? options.scroll ?? (isPop ? "restore" : "top");
      pendingScroll = { policy, key: currentKey ?? "" };
      // Publr render effects are already queued by the state writes above.
      if (options.commit !== "manual")
        queueMicrotask(() => {
          if (myNavigation === navigation) commit();
        });
    } catch (err) {
      if (myNavigation !== navigation || navigationController.signal.aborted || isAbort(err))
        return;
      current.error = err;
      current.status = "error";
    }
  }

  const onPopState = () => void transition(location.href, "none", {}, true);
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!target || target.closest('[data-p-router="off"]')) return;
    if (target.download || (target.target && target.target.toLowerCase() !== "_self")) return;

    const url = new URL(target.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.hash && url.pathname === location.pathname && url.search === location.search) {
      return;
    }
    if (!matchesFor(url).length) return;

    event.preventDefault();
    void transition(url, "push");
  };
  const onScroll = () => recordScroll();

  const router: Router<TMeta> = {
    current,
    start() {
      if (started || !hasBrowser) return router;
      started = true;
      window.addEventListener("popstate", onPopState);
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      document.addEventListener("click", onClick);
      void transition(location.href, "none");
      return router;
    },
    navigate(href, navOptions) {
      return transition(href, navOptions?.replace ? "replace" : "push", navOptions);
    },
    replace(href, navOptions) {
      return transition(href, "replace", navOptions);
    },
    prefetch(href, prefetchOptions) {
      const url = new URL(String(href), hasBrowser ? location.href : initialUrl);
      const prefetchController = new AbortController();
      const signal = prefetchOptions?.signal ?? prefetchController.signal;
      return runLoaders(url, matchesFor(url), signal);
    },
    commit,
    destroy() {
      controller?.abort();
      controller = null;
      navigation++;
      pendingScroll = null;

      if (started && hasBrowser) {
        window.removeEventListener("popstate", onPopState);
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("click", onClick);
      }

      started = false;
    },
  };

  return router;
}

Publr.router = createRouter;

export { matchRoutes, Publr };
