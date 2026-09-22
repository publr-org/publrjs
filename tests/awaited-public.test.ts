import { describe, expect, it, vi } from "vitest";
import {
  awaited,
  reactive,
  createLocalStore,
  createStoreContainer,
  hydrate,
  destroy,
} from "../src/publr";
import { createScope, disposeScope, runInScope } from "../src/core/reactivity";
import { operation, httpOperation } from "../src/transport";
import { deferred, tick } from "./helpers";

describe("public callback awaited", () => {
  it("starts inline local results with seeded state and tracks independent instances", async () => {
    const host = document.createElement("div");
    host.innerHTML = `<section data-p-store="InlinePeople" data-p='{"search":"Ada"}'></section><section data-p-store="InlinePeople" data-p='{"search":"Elena"}'></section>`;
    document.body.append(host);
    const container = createStoreContainer({ root: host });
    const queries: string[] = [];
    const requests: ReturnType<typeof deferred<string[]>>[] = [];
    const stores: any[] = [];
    createLocalStore("InlinePeople", ({ state }) => {
      stores.push(state);
      return {
        state: {
          search: "",
          people: awaited(() => {
            queries.push(state.search);
            const request = deferred<string[]>();
            requests.push(request);
            return request.promise;
          }),
        },
      };
    });
    try {
      hydrate(host);
      expect(queries).toEqual(["Ada", "Elena"]);
      requests[0].resolve(["Ada"]);
      requests[1].resolve(["Elena"]);
      await tick();
      stores[0].search = "Jules";
      await tick();
      expect(queries).toEqual(["Ada", "Elena", "Jules"]);
      expect(stores[0].people.value).toEqual(["Ada"]);
      expect(stores[1].people.value).toEqual(["Elena"]);
      destroy(host);
      requests[2].resolve(["Jules"]);
      await tick();
      expect(stores[0].people.value).toEqual(["Ada"]);
    } finally {
      container.dispose();
      host.remove();
    }
  });

  it("starts inline shared results only after the reactive self-reference is bound", async () => {
    const container = createStoreContainer();
    const queries: string[] = [];
    try {
      const store = container.createStore("InlineShared", ({ state }) => ({
        state: {
          search: "Ada",
          people: awaited(() => {
            queries.push(state.search);
            return Promise.resolve([state.search]);
          }),
        },
      }));
      expect(queries).toEqual(["Ada"]);
      await tick();
      store.search = "Elena";
      await tick();
      expect(queries).toEqual(["Ada", "Elena"]);
      expect(store.people.value).toEqual(["Elena"]);
    } finally {
      container.dispose();
    }
  });

  it("tracks inputs, retains results and owns loading/error state", async () => {
    const scope = createScope();
    const state = reactive({ search: "Ada" });
    const requests = [deferred<string[]>(), deferred<string[]>(), deferred<string[]>()];
    let calls = 0;
    const result = runInScope(scope, () =>
      awaited(() => {
        void state.search;
        return requests[calls++].promise;
      }),
    );
    const store = reactive({ people: result });
    expect(store.people.isPending).toBe(true);
    expect(store.people.isLoaded).toBe(false);
    expect(store.people.value).toBeUndefined();
    requests[0].resolve(["Ada"]);
    await tick();
    expect(store.people.value).toEqual(["Ada"]);
    expect(store.people.isLoaded).toBe(true);
    expect(store.people.isPending).toBe(false);
    state.search = "Elena";
    expect(store.people.isPending).toBe(true);
    expect(store.people.value).toEqual(["Ada"]);
    requests[1].reject(new Error("offline"));
    await tick();
    expect(store.people.isError).toBe(true);
    expect(store.people.error).toEqual(new Error("offline"));
    expect(store.people.isPending).toBe(false);
    expect(store.people.value).toEqual(["Ada"]);
    store.people.refresh();
    requests[2].resolve([]);
    await tick();
    expect(store.people.value).toEqual([]);
    expect(store.people.isLoaded).toBe(true);
    expect(store.people.isError).toBe(false);
    disposeScope(scope);
  });

  it("ignores obsolete and disposed promises even when they cannot be cancelled", async () => {
    const scope = createScope();
    const state = reactive({ index: 0 });
    const requests = [deferred<string>(), deferred<string>(), deferred<string>()];
    const result = runInScope(scope, () => awaited(() => requests[state.index].promise));
    state.index = 1;
    await tick();
    requests[1].resolve("new");
    await tick();
    requests[0].resolve("old");
    await tick();
    expect(result.value).toBe("new");
    state.index = 2;
    await tick();
    disposeScope(scope);
    requests[2].resolve("disposed");
    await tick();
    expect(result.value).toBe("new");
  });

  it.each(["native", "http"])(
    "cancels %s requests on replacement and disposal",
    async (transport) => {
      const scope = createScope();
      const state = reactive({ search: "Ada" });
      const signals: AbortSignal[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, options: RequestInit) => {
          signals.push(options.signal as AbortSignal);
          return new Promise<Response>(() => {});
        }),
      );
      try {
        runInScope(scope, () =>
          awaited(() =>
            transport === "native"
              ? operation("/people", [state.search])
              : httpOperation(`/people?search=${state.search}`)(),
          ),
        );
        expect(signals[0].aborted).toBe(false);
        state.search = "Elena";
        expect(signals[0].aborted).toBe(true);
        await tick();
        expect(signals).toHaveLength(2);
        expect(signals[1].aborted).toBe(false);
        disposeScope(scope);
        expect(signals[1].aborted).toBe(true);
      } finally {
        disposeScope(scope);
        vi.unstubAllGlobals();
      }
    },
  );
});
