import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, loadRuntime, tick, type Runtime } from "./helpers";
import { matchRoutes } from "../src/router/match";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  history.replaceState({}, "", "/");
  rt = await loadRuntime({ query: true, router: true });
  Publr = rt.Publr;
});

describe("route matching", () => {
  const routes = [
    { path: "/", id: "home" },
    {
      path: "/projects",
      id: "projects",
      children: [{ path: ":projectId", id: "project" }],
    },
    { path: "/files/*path", id: "files" },
  ];

  it("matches static, nested param, and terminal wildcard routes", () => {
    expect(matchRoutes(routes, "/").map((match) => match.id)).toEqual(["home"]);

    const nested = matchRoutes(routes, "/projects/a%20b/");
    expect(nested.map((match) => match.id)).toEqual(["projects", "project"]);
    expect(nested.at(-1)?.params).toEqual({ projectId: "a b" });

    const wildcard = matchRoutes(routes, "/files/docs/getting-started");
    expect(wildcard.at(-1)?.params).toEqual({ path: "docs/getting-started" });
    expect(matchRoutes(routes, "/files").at(-1)?.params).toEqual({ path: "" });
  });

  it("returns an empty chain for not-found paths and rejects non-terminal wildcards", () => {
    expect(matchRoutes(routes, "/missing")).toEqual([]);
    expect(() => matchRoutes([{ path: "/bad/*path/rest", id: "bad" }], "/bad/x/rest")).toThrow(
      /wildcard must be the final segment/,
    );
  });
});

describe("browser router", () => {
  it("exposes reactive URL state and runs the ordered matched loader chain", async () => {
    const loaded: string[] = [];
    const router = Publr.router!({
      routes: [
        {
          path: "/projects",
          id: "projects",
          load: () => loaded.push("projects"),
          children: [
            {
              path: ":projectId",
              id: "project",
              load: ({ params, search }) => loaded.push(`${params.projectId}:${search.get("tab")}`),
            },
          ],
        },
      ],
    });

    await router.navigate("/projects/42?tab=activity#latest");

    expect(location.pathname).toBe("/projects/42");
    expect(router.current.pathname).toBe("/projects/42");
    expect(router.current.params).toEqual({ projectId: "42" });
    expect(router.current.search.get("tab")).toBe("activity");
    expect(router.current.hash).toBe("#latest");
    expect(router.current.matches.map((match) => match.id)).toEqual(["projects", "project"]);
    expect(router.current.status).toBe("ready");
    expect(loaded).toEqual(["projects", "42:activity"]);
  });

  it("aborts superseded loaders and ignores their late result", async () => {
    const slow = deferred<void>();
    let slowSignal!: AbortSignal;
    const router = Publr.router!({
      routes: [
        {
          path: "/slow",
          id: "slow",
          load: ({ signal }) => {
            slowSignal = signal;
            return slow.promise;
          },
        },
        { path: "/fast", id: "fast", load: async () => undefined },
      ],
    });

    const abandoned = router.navigate("/slow");
    await tick();
    await router.navigate("/fast");
    expect(slowSignal.aborted).toBe(true);
    expect(router.current.matches[0].id).toBe("fast");
    expect(router.current.status).toBe("ready");

    slow.resolve();
    await abandoned;
    expect(router.current.matches[0].id).toBe("fast");
  });

  it("captures loader errors in route state", async () => {
    const failure = new Error("route failed");
    const router = Publr.router!({
      routes: [
        {
          path: "/failure",
          id: "failure",
          load: async () => Promise.reject(failure),
        },
      ],
    });

    await router.navigate("/failure");
    expect(router.current.status).toBe("error");
    expect(router.current.error).toBe(failure);
  });

  it("progressively intercepts eligible links and leaves opted-out/hash links native", async () => {
    document.body.innerHTML = `
      <a id="internal" href="/page">page</a>
      <a id="off" href="/page" data-p-router="off">off</a>
      <a id="hash" href="#section">hash</a>
    `;
    const router = Publr.router!({
      routes: [{ path: "/page", id: "page" }],
    }).start();
    await tick();

    const internal = document.querySelector("#internal")!;
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    internal.dispatchEvent(click);
    await tick();
    expect(click.defaultPrevented).toBe(true);
    expect(location.pathname).toBe("/page");

    history.replaceState(history.state, "", "/");
    const offClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    document.querySelector("#off")!.dispatchEvent(offClick);
    expect(offClick.defaultPrevented).toBe(false);

    const hashClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    document.querySelector("#hash")!.dispatchEvent(hashClick);
    expect(hashClick.defaultPrevented).toBe(false);
    router.destroy();
  });

  it("applies top/preserve scroll to window and named regions", async () => {
    document.body.innerHTML = `<main data-p-scroll="content"></main>`;
    const region = document.querySelector<HTMLElement>("main")!;
    const router = Publr.router!({
      routes: [
        { path: "/one", id: "one" },
        { path: "/two", id: "two" },
      ],
    });

    region.scrollTop = 80;
    await router.navigate("/one", { scroll: "preserve" });
    router.commit();
    expect(region.scrollTop).toBe(80);

    await router.navigate("/two", { scroll: "top" });
    router.commit();
    expect(region.scrollTop).toBe(0);
  });

  it("restores named-region scroll on browser back navigation", async () => {
    document.body.innerHTML = `<main data-p-scroll="content"></main>`;
    const region = document.querySelector<HTMLElement>("main")!;
    const router = Publr.router!({
      routes: [
        { path: "/one", id: "one" },
        { path: "/two", id: "two" },
      ],
      scroll: "restore",
    }).start();
    await tick();

    await router.navigate("/one", { scroll: "preserve" });
    region.scrollTop = 65;
    await router.navigate("/two", { scroll: "top" });
    expect(region.scrollTop).toBe(0);

    history.back();
    await tick();
    await tick();
    expect(location.pathname).toBe("/one");
    expect(region.scrollTop).toBe(65);
    router.destroy();
  });

  it("route prefetch runs loaders without publishing navigation", async () => {
    let fetches = 0;
    const router = Publr.router!({
      routes: [
        { id: "project", path: "/project", load: async () => ({ title: `Project ${++fetches}` }) },
      ],
    });
    const pathname = router.current.pathname;
    const values = await router.prefetch("/project");
    expect(values).toEqual([{ title: "Project 1" }]);
    expect(router.current.pathname).toBe(pathname);
    router.destroy();
  });
});

it("manual view commits wait for loaders and discard superseded scroll work", async () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const request = deferred<void>();
  const router = Publr.router!({
    commit: "manual",
    routes: [
      { id: "manual", path: "/manual", load: () => request.promise },
      { id: "next", path: "/next" },
    ],
  });
  const navigation = router.navigate("/manual");
  expect(location.pathname).toBe("/manual");
  router.commit();
  expect(scroll).not.toHaveBeenCalled();
  request.resolve();
  await navigation;
  await tick();
  expect(scroll).not.toHaveBeenCalled();
  router.commit();
  expect(scroll).toHaveBeenCalledTimes(1);
  await router.navigate("/manual");
  await router.navigate("/next", { scroll: "preserve" });
  router.commit();
  expect(scroll).toHaveBeenCalledTimes(1);
  router.destroy();
  scroll.mockRestore();
});
