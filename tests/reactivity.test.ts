// Public reactivity API: reactive() proxies, effect() scheduling, untrack.

import { beforeEach, describe, expect, it } from "vitest";
import { loadRuntime, tick, touch, captureMicrotasks, type Runtime } from "./helpers";

let rt: Runtime;

beforeEach(async () => {
  rt = await loadRuntime();
});

describe("reactive", () => {
  it("propagates signed-zero changes through memoized getters without repeating NaN updates", async () => {
    const source = rt.reactive({ n: 0 });
    const computed = rt.reactive({
      get n() {
        return source.n;
      },
    });
    await tick();
    const seen: number[] = [];
    rt.effect(() => seen.push(1 / computed.n));
    await tick();
    source.n = -0;
    await tick();
    source.n = NaN;
    await tick();
    source.n = NaN;
    await tick();
    expect(seen).toEqual([Infinity, -Infinity, NaN]);
  });
  it("wraps plain objects and re-runs effects on change", async () => {
    const state = rt.reactive({ n: 1 });
    const seen: number[] = [];
    rt.effect(() => seen.push(state.n));

    expect(seen).toEqual([]);
    await tick();
    expect(seen).toEqual([1]);
    state.n = 2;
    await tick();
    expect(seen).toEqual([1, 2]);
  });

  it("is deep: nested objects and arrays are reactive", async () => {
    const state = rt.reactive({ user: { name: "ada" }, list: [1, 2] });
    let name = "";
    let len = 0;
    rt.effect(() => (name = state.user.name));
    rt.effect(() => (len = state.list.length));

    state.user.name = "grace";
    state.list.push(3);
    await tick();
    expect(name).toBe("grace");
    expect(len).toBe(3);
  });

  it("tracks array length changes from index writes and mutations", async () => {
    const state = rt.reactive({ items: ["a"] });
    let len = 0;
    rt.effect(() => (len = state.items.length));

    state.items[3] = "d";
    await tick();
    expect(len).toBe(4);
  });

  it("returns the same proxy for the same target (identity stable)", () => {
    const raw = { n: 1 };
    const a = rt.reactive(raw);
    const b = rt.reactive(raw);
    expect(a).toBe(b);
    expect(rt.reactive(a)).toBe(a);
  });

  it("passes primitives and null through", () => {
    expect(rt.reactive(null)).toBe(null);
    expect(rt.reactive(42)).toBe(42);
    expect(rt.reactive("x")).toBe("x");
  });

  it("does not wrap non-plain objects (Date, Map, Set, class instances)", () => {
    const date = new Date();
    const map = new Map();
    const set = new Set();
    class Thing {}
    const thing = new Thing();

    expect(rt.reactive(date)).toBe(date);
    expect(rt.reactive(map)).toBe(map);
    expect(rt.reactive(set)).toBe(set);
    expect(rt.reactive(thing)).toBe(thing);
  });

  it("does not re-trigger when a value is set to the same value", async () => {
    const state = rt.reactive({ n: 1 });
    let runs = 0;
    rt.effect(() => {
      touch(state.n);
      runs++;
    });

    state.n = 1;
    await tick();
    expect(runs).toBe(1);
  });
});

describe("effect", () => {
  it("batches multiple writes into one microtask re-run", async () => {
    const state = rt.reactive({ a: 1, b: 1 });
    let runs = 0;
    rt.effect(() => {
      touch(state.a);
      touch(state.b);
      runs++;
    });

    await tick();
    expect(runs).toBe(1);

    state.a = 2;
    state.b = 2;
    state.a = 3;
    await tick();
    expect(runs).toBe(2); // initial + one batched re-run
  });

  it("returns a runner that re-runs inline and returns the last value", async () => {
    const state = rt.reactive({ n: 2 });
    const runner = rt.effect(() => state.n * 10);
    await tick();
    expect(runner()).toBe(20);
    state.n = 5;
    expect(runner()).toBe(50);
  });

  it("supports lazy effects (no initial run)", () => {
    let runs = 0;
    const runner = rt.effect(() => runs++, { lazy: true });
    expect(runs).toBe(0);
    runner();
    expect(runs).toBe(1);
  });

  it("only re-tracks dependencies read on the latest run", async () => {
    const state = rt.reactive({ useA: true, a: 1, b: 1 });
    let runs = 0;
    rt.effect(() => {
      runs++;
      touch(state.useA ? state.a : state.b);
    });

    await tick();
    state.useA = false;
    await tick();
    expect(runs).toBe(2);

    // `a` is no longer a dependency
    state.a = 99;
    await tick();
    expect(runs).toBe(2);

    state.b = 99;
    await tick();
    expect(runs).toBe(3);
  });

  it("runs after the current work and provides initial/run context", async () => {
    const state = rt.reactive({ n: 1 });
    const seen: Array<{ isInitial: boolean; run: number; n: number }> = [];

    rt.effect((context) => {
      seen.push({ ...context, n: state.n });
    });

    expect(seen).toEqual([]);
    await tick();
    expect(seen).toEqual([{ isInitial: true, run: 0, n: 1 }]);

    state.n = 2;
    await tick();
    expect(seen[1]).toEqual({ isInitial: false, run: 1, n: 2 });
  });

  it("tracks only dependencies read before an initial early return", async () => {
    const state = rt.reactive({ n: 1 });
    let reruns = 0;

    rt.effect((context) => {
      if (context.isInitial) return;
      touch(state.n);
      reruns += 1;
    });

    await tick();
    state.n = 2;
    await tick();
    expect(reruns).toBe(0);
  });

  it("detects infinite update loops and reports the effect label", () => {
    const micro = captureMicrotasks();
    try {
      const state = rt.reactive({ n: 0 });
      rt.effect(
        () => {
          state.n = state.n + 1;
        },
        { label: "runaway" },
      );
      expect(() => micro.runAll()).toThrowError(/Infinite update loop.*runaway/);
    } finally {
      micro.restore();
    }
  });
});

describe("computed getters", () => {
  it("tracks this-based derived arrays and values through nested edits and stack mutations", async () => {
    const navigation = rt.Publr.createStore("navigation", () => ({
      state: {
        items: [] as Array<{ title: string }>,
        get levels() {
          return this.items.map((item) => item.title);
        },
        get open() {
          return this.items.length > 0;
        },
      },
    }))!;
    let seen: unknown;
    rt.effect(() => {
      seen = [navigation.open, navigation.levels];
    });
    await tick();
    expect(seen).toEqual([false, []]);
    navigation.items.push({ title: "Loading" });
    await tick();
    expect(seen).toEqual([true, ["Loading"]]);
    navigation.items[0].title = "Alice";
    await tick();
    expect(seen).toEqual([true, ["Alice"]]);
    navigation.items.push({ title: "Bob" });
    await tick();
    expect(seen).toEqual([true, ["Alice", "Bob"]]);
    navigation.items.splice(0);
    await tick();
    expect(seen).toEqual([false, []]);
  });

  it("memoizes getters and exposes their value (deferred a microtask)", async () => {
    const other = rt.reactive({ n: 2 });
    const state = rt.reactive({
      get double() {
        return other.n * 2;
      },
    });
    await tick();
    expect(state.double).toBe(4);
  });

  it("recomputes when a reactive dependency read via closure changes", async () => {
    const other = rt.reactive({ n: 2 });
    const state = rt.reactive({
      get double() {
        return other.n * 2;
      },
    });
    await tick();

    let seen = 0;
    rt.effect(() => (seen = state.double));
    await tick();
    expect(seen).toBe(4);

    other.n = 10;
    await tick();
    expect(seen).toBe(20);
    expect(state.double).toBe(20);
  });

  it("throws when a getter writes to state — getters must be pure", () => {
    const micro = captureMicrotasks();
    try {
      const other = rt.reactive({ n: 0 });
      rt.reactive({
        get impure() {
          other.n = other.n + 1;
          return other.n;
        },
      });
      expect(() => micro.runAll()).toThrowError(/Computed getter 'impure'.*must be pure/);
    } finally {
      micro.restore();
    }
  });
});

describe("Publr.untrack", () => {
  it("reads without creating dependencies; writes still trigger", async () => {
    const state = rt.reactive({ tracked: 1, ignored: 1 });
    let runs = 0;
    rt.effect(() => {
      runs++;
      touch(state.tracked);
      touch(rt.Publr.untrack(() => state.ignored));
    });

    state.ignored = 2;
    await tick();
    expect(runs).toBe(1);

    state.tracked = 2;
    await tick();
    expect(runs).toBe(2);
  });

  it("returns the callback's value", () => {
    expect(rt.Publr.untrack(() => 7)).toBe(7);
  });
});

describe("Publr.randomId", () => {
  it("generates unique non-empty ids", () => {
    const a = rt.Publr.randomId();
    const b = rt.Publr.randomId();
    expect(a).toBeTruthy();
    expect(typeof a).toBe("string");
    expect(a).not.toBe(b);
  });
});
