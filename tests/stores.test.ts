// Publr.createStore / Publr.createLocalStore / subscriptions / watch / seeds.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRuntime, tick, html, $, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("Publr.createStore — shared stores", () => {
  it("initializes seeded state once and keeps effects alive after consumers leave", async () => {
    html('<script id="publr-state-session" type="application/json">{"count":4}</script>');
    const seen = vi.fn();
    const cleanup = vi.fn();
    const init = vi.fn();
    const store = Publr.createStore("session", ({ state }) => ({
      state: { count: 0 },
      actions: {
        increment() {
          state.count++;
        },
      },
      init() {
        init(state.count);
        expect(Publr.stores.session.count).toBe(4);
        expect(typeof Publr.stores.session.increment).toBe("function");
        rt.effect(() => seen(state.count));
        return cleanup;
      },
    }));
    await tick();
    expect(init).toHaveBeenCalledExactlyOnceWith(4);
    expect(seen).toHaveBeenLastCalledWith(4);
    html(
      '<div data-p-store="session"><b data-p-text="count"></b></div><div data-p-store="session"><b data-p-text="count"></b></div>',
    );
    Publr.hydrate(document);
    await tick();
    Publr.destroy(document.body);
    document.body.replaceChildren();
    store.increment();
    await tick();
    expect(seen).toHaveBeenLastCalledWith(5);
    expect(init).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("isolates init effects and DOM cleanup between creation containers", async () => {
    const a = rt.createStoreContainer();
    const b = rt.createStoreContainer();
    const seenA = vi.fn(),
      seenB = vi.fn(),
      cleanup = vi.fn(),
      event = vi.fn();
    const first = a.createStore("counter", ({ state }) => ({
      state: { count: 0 },
      init() {
        window.addEventListener("store-init-test", event);
        rt.effect(() => seenA(state.count));
        return () => {
          window.removeEventListener("store-init-test", event);
          cleanup();
        };
      },
    }));
    const second = b.createStore("counter", ({ state }) => ({
      state: { count: 0 },
      init() {
        rt.effect(() => seenB(state.count));
      },
    }));
    await tick();
    window.dispatchEvent(new Event("store-init-test"));
    expect(event).toHaveBeenCalledTimes(1);
    a.dispose();
    a.dispose();
    first.count++;
    second.count++;
    window.dispatchEvent(new Event("store-init-test"));
    await tick();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(event).toHaveBeenCalledTimes(1);
    expect(seenA).toHaveBeenCalledTimes(1);
    expect(seenB).toHaveBeenLastCalledWith(1);
    b.dispose();
  });

  it("cancels pending init effects if the container is immediately disposed", async () => {
    const app = rt.createStoreContainer();
    const seen = vi.fn(),
      cleanup = vi.fn();
    app.createStore("cancelled", () => ({
      init() {
        rt.effect(seen);
        return cleanup;
      },
    }));
    app.dispose();
    await tick();
    expect(seen).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("rolls back failed init without disposing another store and allows retry", async () => {
    const app = rt.createStoreContainer();
    const failed = vi.fn(),
      healthy = vi.fn(),
      watched = vi.fn();
    const alive = app.createStore("alive", ({ state }) => ({
      state: { n: 0 },
      init() {
        rt.effect(() => healthy(state.n));
      },
    }));
    expect(() =>
      app.createStore("retry", ({ state }) => ({
        state: { n: 0 },
        watch: { n: watched },
        init() {
          rt.effect(() => failed(state.n));
          throw new Error("init failed");
        },
      })),
    ).toThrow("init failed");
    expect(app.stores.retry).toBeUndefined();
    const retried = app.createStore("retry", () => ({ state: { n: 1 } }));
    alive.n++;
    retried.n++;
    await tick();
    expect(failed).not.toHaveBeenCalled();
    expect(watched).not.toHaveBeenCalled();
    expect(healthy).toHaveBeenLastCalledWith(1);
    app.dispose();
  });

  it("registers a named store with reactive state and returns the entry", async () => {
    const entry = Publr.createStore("cart", () => ({
      state: { count: 0 },
      actions: ({ state }) => ({
        increment: () => state.count++,
      }),
    }));
    let seen = 0;
    rt.effect(() => (seen = entry.count));

    entry.increment();
    await tick();
    expect(entry.count).toBe(1);
    expect(seen).toBe(1);
    expect(Publr.stores.cart.increment).toBe(entry.increment);
  });

  it("lets the definition factory reference its eventual reactive state", () => {
    const entry = Publr.createStore("self", ({ state }) => ({
      state: {
        count: 1,
        get doubled() {
          return state.count * 2;
        },
      },
      actions: ({ state }) => ({
        increment: () => state.count++,
      }),
    }));

    expect(entry.doubled).toBe(2);
    entry.increment();
    expect(entry.doubled).toBe(4);
  });

  it("exposes shared stores by name via Publr.stores", () => {
    Publr.createStore("a", () => ({ state: { x: 1 } }));
    Publr.createStore("b", () => ({ state: { y: 2 } }));
    expect(Publr.stores.a.x).toBe(1);
    expect(Publr.stores.b.y).toBe(2);
    expect(Publr.stores.missing).toBeUndefined();
  });

  it("defaults missing state/actions to empty objects", () => {
    const entry = Publr.createStore("bare", () => ({}))!;
    expect(Object.keys(entry)).toEqual([]);
  });

  it("merges an SSR seed from #publr-state-<name> at registration", () => {
    html(`<script type="application/json" id="publr-state-profile">
      {"user":{"name":"seeded"},"count":9}
    </script>`);
    const entry = Publr.createStore("profile", () => ({
      state: { user: { name: "default", role: "admin" }, count: 0 },
    }))!;

    expect(entry.user.name).toBe("seeded");
    expect(entry.user.role).toBe("admin"); // deep merge keeps unseeded keys
    expect(entry.count).toBe(9);
  });

  it("ignores malformed SSR seeds", () => {
    html(`<script type="application/json" id="publr-state-broken">not json</script>`);
    const entry = Publr.createStore("broken", () => ({ state: { ok: true } }))!;
    expect(entry.ok).toBe(true);
  });

  it("applies inline data-p seeds to shared stores on hydrate", async () => {
    Publr.createStore("counter", () => ({ state: { count: 0, label: "x" } }));
    html(`<div data-p-store="counter" data-p='{"count":5}'></div>`);
    Publr.hydrate(document);
    await tick();

    expect(Publr.stores.counter.count).toBe(5);
    expect(Publr.stores.counter.label).toBe("x");
  });
});

describe("Publr.createLocalStore", () => {
  it("registers a factory and instantiates one store per island", async () => {
    let instances = 0;
    Publr.createLocalStore("widget", () => ({
      state: { n: ++instances },
      actions: {},
    }));

    html(`
      <div data-p-store="widget"><span class="out" data-p-text="n"></span></div>
      <div data-p-store="widget"><span class="out" data-p-text="n"></span></div>
    `);
    Publr.hydrate(document);
    await tick();

    expect(instances).toBe(2);
    const outs = [...document.querySelectorAll(".out")].map((el) => el.textContent);
    expect(outs).toEqual(["1", "2"]);
  });

  it("applies inline data-p seeds per island instance", async () => {
    Publr.createLocalStore("item", () => ({ state: { qty: 1 }, actions: {} }));
    html(`
      <div id="a" data-p-store="item" data-p='{"qty":7}'><i data-p-text="qty"></i></div>
      <div id="b" data-p-store="item"><i data-p-text="qty"></i></div>
    `);
    Publr.hydrate(document);
    await tick();

    expect($("#a i").textContent).toBe("7");
    expect($("#b i").textContent).toBe("1");
  });

  it("runs init({ el }) and keeps its teardown for destroy", async () => {
    const teardown = vi.fn();
    let initEl: Element | null = null;
    Publr.createLocalStore("gadget", () => ({
      state: {},
      actions: {},
      init({ el }) {
        initEl = el;
        return teardown;
      },
    }));

    html(`<div id="g" data-p-store="gadget"></div>`);
    Publr.hydrate(document);
    await tick();

    expect(initEl).toBe($("#g"));
    expect(teardown).not.toHaveBeenCalled();

    Publr.destroy($("#g"));
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("ignores local islands whose factory is unregistered", async () => {
    html(`<div data-p-store="ghost"><span data-p-text="x"></span></div>`);
    expect(() => Publr.hydrate(document)).not.toThrow();
  });
});

describe("Publr.subscribe", () => {
  it("subscribe(fn) receives every store change with full metadata", () => {
    const entry = Publr.createStore("s", () => ({ state: { n: 1 } }))!;
    const changes: any[] = [];
    Publr.subscribe((change) => changes.push(change));

    entry.n = 2;
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      store: "s",
      path: "n",
      oldValue: 1,
      newValue: 2,
      isComputed: false,
    });
  });

  it('subscribe("store", fn) filters by store', () => {
    const a = Publr.createStore("a", () => ({ state: { n: 0 } }))!;
    const b = Publr.createStore("b", () => ({ state: { n: 0 } }))!;
    const paths: string[] = [];
    Publr.subscribe("a", (c) => paths.push(`${c.store}.${c.path}`));

    a.n = 1;
    b.n = 1;
    expect(paths).toEqual(["a.n"]);
  });

  it('subscribe("store.path", fn) matches the path and everything under it', () => {
    const entry = Publr.createStore("deep", () => ({
      state: { user: { name: "x", age: 1 }, other: 0 },
    }))!;
    const paths: string[] = [];
    Publr.subscribe("deep.user", (c) => paths.push(c.path));

    entry.user.name = "y";
    entry.user.age = 2;
    entry.other = 1;
    expect(paths).toEqual(["user.name", "user.age"]);
  });

  it("does not fire for a path that merely shares a prefix", () => {
    const entry = Publr.createStore("p", () => ({
      state: { use: 1, user: 1 },
    }))!;
    const paths: string[] = [];
    Publr.subscribe("p.use", (c) => paths.push(c.path));

    entry.user = 2;
    entry.use = 2;
    expect(paths).toEqual(["use"]);
  });

  it("returns an unsubscribe function", () => {
    const entry = Publr.createStore("u", () => ({ state: { n: 0 } }))!;
    const seen: unknown[] = [];
    const unsub = Publr.subscribe("u", (c) => seen.push(c.newValue));

    entry.n = 1;
    unsub();
    entry.n = 2;
    expect(seen).toEqual([1]);
  });

  it("flags computed changes with isComputed", async () => {
    const dep = rt.reactive({ n: 1 });
    Publr.createStore("comp", () => ({
      state: {
        plain: 0,
        get doubled() {
          return dep.n * 2;
        },
      },
    }));
    await tick(); // getter memoization

    const flags: Array<[string, boolean]> = [];
    Publr.subscribe("comp", (c) => flags.push([c.path, c.isComputed]));

    dep.n = 5; // recompute -> computed change notification
    await tick();
    Publr.stores.comp.plain = 1;

    expect(flags).toContainEqual(["doubled", true]);
    expect(flags).toContainEqual(["plain", false]);
  });

  it("throws on invalid arguments", () => {
    expect(() => (Publr.subscribe as any)(42)).toThrowError(/expected \(fn\) or \(selector, fn\)/);
    expect(() => (Publr.subscribe as any)("store")).toThrowError(/expected/);
  });
});

describe("watch blocks", () => {
  it("watches a single path with (newValue, oldValue, { path })", async () => {
    const calls: any[] = [];
    Publr.createStore("w", () => ({
      state: { n: 1 },
      watch: {
        n: (next, prev, ctx) => calls.push([next, prev, ctx.path]),
      },
    }));
    await tick(); // watch wiring is deferred a microtask

    Publr.stores.w.n = 2;
    await tick();
    expect(calls).toEqual([[2, 1, "n"]]);
  });

  it("does not fire on the priming run", async () => {
    const calls: unknown[] = [];
    Publr.createStore("prime", () => ({
      state: { n: 1 },
      watch: { n: (v) => calls.push(v) },
    }));
    await tick();
    expect(calls).toEqual([]);
  });

  it('watches multiple comma-separated paths ("a, b")', async () => {
    const calls: string[] = [];
    Publr.createStore("multi", () => ({
      state: { a: 1, b: 1 },
      watch: {
        "a, b": (_v, _o, ctx) => calls.push(ctx.path),
      },
    }));
    await tick();

    Publr.stores.multi.a = 2;
    await tick();
    Publr.stores.multi.b = 2;
    await tick();
    expect(calls).toEqual(["a", "b"]);
  });

  it('"*" fires for every change in the store', async () => {
    const paths: string[] = [];
    Publr.createStore("star", () => ({
      state: { a: 1, nested: { b: 1 } },
      watch: { "*": (_v, _o, ctx) => paths.push(ctx.path) },
    }));
    await tick();

    Publr.stores.star.a = 2;
    Publr.stores.star.nested.b = 2;
    expect(paths).toEqual(["a", "nested.b"]);
  });

  it('"*:static" skips computed changes; "*:computed" only sees them', async () => {
    const dep = rt.reactive({ n: 1 });
    const statics: string[] = [];
    const computeds: string[] = [];
    Publr.createStore("filtered", () => ({
      state: {
        plain: 0,
        get calc() {
          return dep.n * 2;
        },
      },
      watch: {
        "*:static": (_v, _o, ctx) => statics.push(ctx.path),
        "*:computed": (_v, _o, ctx) => computeds.push(ctx.path),
      },
    }));
    await tick();

    Publr.stores.filtered.plain = 1;
    dep.n = 3;
    await tick();

    expect(statics).toEqual(["plain"]);
    expect(computeds).toEqual(["calc"]);
  });
});

describe("window global", () => {
  it("does not install a global runtime", () => {
    expect(Object.hasOwn(window, "Publr")).toBe(false);
  });
});

describe("local store initial text", () => {
  it("adopts numeric text per instance before init and keeps numeric actions", async () => {
    const initialized: number[] = [];
    Publr.createLocalStore("textCounter", ({ state }) => ({
      state: { count: 0 },
      actions: {
        increment() {
          state.count++;
        },
      },
      init() {
        initialized.push(state.count);
      },
    }));
    html(`<section data-p-store="textCounter"><output data-p-text="$count">0</output><button data-p-on="click:increment">+</button></section>
      <section data-p-store="textCounter"><output data-p-text="$count">10</output><button data-p-on="click:increment">+</button></section>`);
    Publr.hydrate(document);
    expect(initialized).toEqual([0, 10]);
    document.querySelectorAll("button")[1].click();
    await tick();
    expect([...document.querySelectorAll("output")].map((el) => el.textContent)).toEqual([
      "0",
      "11",
    ]);
    Publr.hydrate(document);
    expect(initialized).toEqual([0, 10]);
  });

  it("infers scalar types, falls back to strings, and skips invalid numbers and empty placeholders", () => {
    let result: Record<string, unknown> = {};
    Publr.createLocalStore("textTypes", ({ state }) => ({
      state: {
        count: 0,
        invalid: 3,
        blank: 4,
        enabled: true,
        large: 0n,
        name: "",
        user: { age: 0 },
      },
      init() {
        result = Object.fromEntries(
          ["count", "invalid", "blank", "enabled", "large", "name", "missing", "user"].map(
            (key) => [key, (state as Record<string, unknown>)[key]],
          ),
        );
      },
    }));
    html(`<section data-p-store="textTypes">
      <i data-p-text="$count">12.5</i><i data-p-text="$invalid">not a number</i>
      <i data-p-text="$blank"></i><i data-p-text="$enabled">false</i>
      <i data-p-text="$large">9007199254740993</i><i data-p-text="$name">123</i>
      <i data-p-text="$missing">007</i><i data-p-text="$user.age">42</i>
    </section>`);
    Publr.hydrate(document);
    expect(result).toEqual({
      count: 12.5,
      invalid: 3,
      blank: 4,
      enabled: false,
      large: 9007199254740993n,
      name: "123",
      missing: "007",
      user: { age: 42 },
    });
  });

  it("uses explicit seeds, skips derived and formatted bindings, and isolates nested stores", async () => {
    let outer: Record<string, unknown> = {};
    let inner = 0;
    Publr.createLocalStore("outerText", ({ state }) => ({
      state: {
        count: 1,
        get doubled() {
          return state.count * 2;
        },
      },
      init() {
        outer = { count: state.count, doubled: state.doubled };
      },
    }));
    Publr.createLocalStore("innerText", ({ state }) => ({
      state: { count: 0 },
      init() {
        inner = state.count;
      },
    }));
    html(`<section data-p-store="outerText" data-p='{"count":7}'>
      <i data-p-text="$count">10</i><i data-p-text="$doubled">999</i>
      <i data-p-text="$count ~ 'empty'">formatted</i>
      <div data-p-store="innerText"><i data-p-text="$count">20</i></div>
    </section>`);
    Publr.hydrate(document);
    await tick();
    expect(outer).toEqual({ count: 7, doubled: 14 });
    expect(inner).toBe(20);
  });

  it("keeps ancestor text live when it is composed inside a child store", async () => {
    let parent: Record<string, any>;
    Publr.createLocalStore("parentCount", ({ state }) => ({
      state: { shown: "6 shown" },
      init() {
        parent = state;
      },
    }));
    Publr.createLocalStore("childTable", () => ({ state: { rows: [] } }));
    html(`<div data-p-store="parentCount"><section data-p-store="childTable">
      <span data-p-text="$shown">6 shown</span>
    </section></div>`);
    Publr.hydrate(document);
    parent!.shown = "3 shown";
    await tick();
    expect(document.querySelector("span")!.textContent).toBe("3 shown");
  });

  it("keeps the first initial value, not runtime output, when the same markup rehydrates", async () => {
    const initialized: number[] = [];
    Publr.createLocalStore("repeatText", ({ state }) => ({
      state: { count: 0 },
      actions: {
        increment() {
          state.count++;
        },
      },
      init() {
        initialized.push(state.count);
      },
    }));
    html(`<section data-p-store="repeatText"><output data-p-text="$count">10</output>
      <output data-p-text="$count">20</output><button data-p-on="click:increment">+</button></section>`);
    Publr.hydrate(document);
    document.querySelector("button")!.click();
    await tick();
    expect([...document.querySelectorAll("output")].map((el) => el.textContent)).toEqual([
      "11",
      "11",
    ]);
    Publr.destroy(document.querySelector("section")!);
    Publr.hydrate(document);
    expect(initialized).toEqual([10, 10]);
  });

  it("does not replace shared state or compiled transfer from visible text", () => {
    const shared = Publr.createStore("sharedText", () => ({ state: { count: 5 } }));
    let compiledCount = 0;
    Publr.createLocalStore("transferredText", ({ state }) => ({
      state: { count: 7 },
      init() {
        compiledCount = state.count;
      },
    }));
    html(`<section data-p-store="sharedText"><i data-p-text="$count">100</i></section>
      <section data-p-store="transferredText" data-p-state='{"values":{},"props":{},"cache":{}}'><i data-p-text="$count">200</i></section>`);
    Publr.hydrate(document);
    expect(shared.count).toBe(5);
    expect(compiledCount).toBe(7);
  });
});
