import { describe, expect, it } from "vitest";
import { awaited, derived, state, isPending, errorOf, bindings } from "../src/runtime";
import { effect, reactive, createStore } from "../src/publr";
import { deferred, tick } from "./helpers";

describe("compiled dependency graph", () => {
  it("keeps snapshots, updates closures, and caches derivations", async () => {
    const count = state(1);
    const snapshot = count.read();
    let evaluations = 0;
    const doubled = derived(() => {
      evaluations++;
      return count.read() * 2;
    });
    expect(doubled.read()).toBe(2);
    expect(doubled.read()).toBe(2);
    count.write(3);
    expect(doubled.read()).toBe(6);
    expect(snapshot).toBe(1);
    expect(evaluations).toBe(2);
    expect(
      count.update((v) => {
        const previous = v++;
        return [v, previous];
      }),
    ).toBe(3);
    expect(count.read()).toBe(4);
    await tick();
  });
  it("shares dependencies with reactive objects and HTML stores without getter caches", async () => {
    const data = reactive({ n: 2 });
    const value = derived(() => data.n * 2);
    const store = createStore("compiled-graph", () => ({ state: bindings({ value }) }));
    expect(store.value).toBe(4);
    data.n = 4;
    expect(store.value).toBe(8);
    await tick();
    data.n = 5;
    expect(store.value).toBe(10);
  });
  it("tracks pending through derivations and ignores superseded results", async () => {
    const id = state(1);
    const requests = [deferred<string>(), deferred<string>()];
    const result = awaited(() => requests[id.read() - 1].promise);
    const name = derived(() => result.read().toUpperCase());
    expect(isPending(name)).toBe(true);
    id.write(2);
    expect(isPending(name)).toBe(true);
    requests[0].resolve("old");
    await tick();
    expect(isPending(name)).toBe(true);
    requests[1].resolve("new");
    await tick();
    expect(name.read()).toBe("NEW");
  });
  it("seeds null and tracks initial arguments without a duplicate operation", async () => {
    const id = state(1);
    let calls = 0;
    const result = awaited(
      () => {
        calls++;
        return Promise.resolve(id.read());
      },
      {
        initial: null as number | null,
        inputs: () => id.read(),
      },
    );
    expect(result.read()).toBeNull();
    expect(isPending(result)).toBe(false);
    expect(calls).toBe(0);
    id.write(2);
    expect(isPending(result)).toBe(true);
    await tick();
    expect(result.read()).toBe(2);
    expect(calls).toBe(1);
  });
  it("does not execute effects with mixed input/result generations", async () => {
    const id = state(1);
    const request = deferred<string>();
    const result = awaited(
      () => {
        id.read();
        return request.promise;
      },
      {
        initial: "one",
        inputs: () => id.read(),
      },
    );
    const seen: string[] = [];
    effect(() => {
      seen.push(`${id.read()}:${result.read()}`);
    });
    await tick();
    id.write(2);
    await tick();
    expect(seen).toEqual(["1:one"]);
    request.resolve("two");
    await tick();
    expect(seen).toEqual(["1:one", "2:two"]);
  });
  it("exposes initial errors and supports refresh after failure", async () => {
    let fail = true;
    const result = awaited(() =>
      fail ? Promise.reject(new Error("offline")) : Promise.resolve(7),
    );
    await tick();
    expect(isPending(result)).toBe(false);
    expect(() => result.read()).toThrow("offline");
    expect(errorOf(result)).toBeInstanceOf(Error);
    fail = false;
    result.refresh();
    await tick();
    expect(result.read()).toBe(7);
    expect(errorOf(result)).toBeUndefined();
  });
});

describe("compiled DOM", () => {
  it("retains a whole loading region while independent controls update", async () => {
    const { mount, element, append, text, attr, Loading } = await import("../src/addons/dom");
    const id = state(1);
    const request = deferred<string>();
    const result = awaited(
      () => {
        id.read();
        return request.promise;
      },
      { initial: "one", inputs: () => id.read() },
    );
    const root = document.createElement("div");
    const dispose = mount(root, () =>
      element("section", (el) => {
        attr(el, "data-input", () => id.read());
        append(
          el,
          Loading({
            fallback: () =>
              element("i", (el) =>
                append(
                  el,
                  text(() => "loading"),
                ),
              ),
            children: () =>
              element("output", (el) => {
                append(
                  el,
                  text(() => id.read()),
                );
                append(
                  el,
                  text(() => result.read()),
                );
              }),
          }),
        );
      }),
    );
    const output = root.querySelector("output");
    expect(output?.textContent).toBe("1one");
    id.write(2);
    await tick();
    expect(root.querySelector("section")?.getAttribute("data-input")).toBe("2");
    expect(output?.textContent).toBe("1one");
    request.resolve("two");
    await tick();
    expect(root.querySelector("output")).toBe(output);
    expect(output?.textContent).toBe("2two");
    dispose();
  });
  it("adopts keyed rows and updates same-key replacement objects without replacing controls", async () => {
    const { hydrate, element, append, text, list } = await import("../src/addons/dom");
    const items = state([{ id: 1, name: "one" }]);
    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML =
      "<ul><!--p:list--><!--p:row:1--><li><input><!--p:text-->one</li><!--/p:row:1--><!--/p:list--></ul>";
    const input = root.querySelector("input")!;
    input.value = "draft";
    input.focus();
    const dispose = hydrate(root.querySelector("ul")!, () =>
      element("ul", (el) =>
        append(
          el,
          list(
            () => items.read(),
            (row) => row.id,
            (row) =>
              element("li", (el) => {
                append(
                  el,
                  element("input", () => {}),
                );
                append(
                  el,
                  text(() => row().name),
                );
              }),
          ),
        ),
      ),
    );
    items.write([
      { id: 2, name: "two" },
      { id: 1, name: "updated" },
    ]);
    await tick();
    expect(root.querySelectorAll("li")[1].textContent).toBe("updated");
    expect(root.querySelectorAll("input")[1]).toBe(input);
    expect(input.value).toBe("draft");
    expect(document.activeElement).toBe(input);
    dispose();
    root.remove();
  });
});

it("keeps refresh failures in their region, propagates errors and recovers on retry", async () => {
  const { mount, Loading, element, append, text } = await import("../src/addons/dom");
  const first = deferred<string>();
  const second = deferred<string>();
  const third = deferred<string>();
  let calls = 0;
  const result = awaited(() => [first, second, third][calls++].promise);
  const name = derived(() => result.read().toUpperCase());
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    Loading({
      children: () =>
        element("output", (el) =>
          append(
            el,
            text(() => name.read()),
          ),
        ),
      fallback: () =>
        element("i", (el) =>
          append(
            el,
            text(() => "loading"),
          ),
        ),
      error: () =>
        element("b", (el) =>
          append(
            el,
            text(() => "error"),
          ),
        ),
    }),
  );
  expect(host.textContent).toBe("loading");
  first.resolve("one");
  await tick();
  const output = host.querySelector("output");
  expect(output?.textContent).toBe("ONE");
  result.refresh();
  await tick();
  second.reject(new Error("offline"));
  await tick();
  expect(errorOf(name)).toBeInstanceOf(Error);
  expect(isPending(name)).toBe(false);
  expect(host.querySelector("output")).toBe(output);
  expect(output?.textContent).toBe("ONE");
  result.refresh();
  await tick();
  third.resolve("three");
  await tick();
  expect(host.querySelector("output")).toBe(output);
  expect(output?.textContent).toBe("THREE");
  dispose();
});
it("renders an initial error fallback and retries without rebuilding successful content", async () => {
  const { mount, Loading, element, append, text } = await import("../src/addons/dom");
  let fail = true;
  const result = awaited(() =>
    fail ? Promise.reject(new Error("offline")) : Promise.resolve("ready"),
  );
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    Loading({
      children: () =>
        element("output", (el) =>
          append(
            el,
            text(() => result.read()),
          ),
        ),
      fallback: () =>
        element("i", (el) =>
          append(
            el,
            text(() => "loading"),
          ),
        ),
      error: () =>
        element("b", (el) =>
          append(
            el,
            text(() => "error"),
          ),
        ),
    }),
  );
  await tick();
  expect(host.textContent).toBe("error");
  fail = false;
  result.refresh();
  await tick();
  expect(host.textContent).toBe("ready");
  dispose();
});
it("waits for chained async dependencies and runs effects after coherent DOM commits", async () => {
  const { mount, element, append, text, Loading } = await import("../src/addons/dom");
  const input = state(1);
  const projectRequest = deferred<string>();
  const permissionRequest = deferred<string>();
  const project = awaited(
    () => {
      input.read();
      return projectRequest.promise;
    },
    { initial: "one", inputs: () => input.read() },
  );
  const permission = awaited(
    () => {
      project.read();
      return permissionRequest.promise;
    },
    { initial: "allowed", inputs: () => project.read() },
  );
  const host = document.createElement("div");
  const seen: string[] = [];
  const dispose = mount(host, () => {
    effect(() => {
      project.read();
      permission.read();
      seen.push(host.textContent ?? "");
    });
    return Loading({
      children: () =>
        element("output", (el) =>
          append(
            el,
            text(() => `${project.read()}:${permission.read()}`),
          ),
        ),
      fallback: () => element("i", () => {}),
    });
  });
  await tick();
  input.write(2);
  await tick();
  projectRequest.resolve("two");
  await tick();
  expect(host.textContent).toBe("one:allowed");
  expect(seen).toEqual(["one:allowed"]);
  permissionRequest.resolve("denied");
  await tick();
  expect(host.textContent).toBe("two:denied");
  expect(seen).toEqual(["one:allowed", "two:denied"]);
  dispose();
});
it("retires async owners without aborting another consumer of a shared request", async () => {
  const { mount, element, append, text, Loading } = await import("../src/addons/dom");
  const request = deferred<string>();
  let calls = 0;
  const make = () => {
    const data = awaited(
      () => {
        calls++;
        return request.promise;
      },
      { cache: { key: ["retired-shared"], ttl: 1000 } },
    );
    return Loading({
      children: () =>
        element("output", (el) =>
          append(
            el,
            text(() => data.read()),
          ),
        ),
      fallback: () => element("i", () => {}),
    });
  };
  const a = document.createElement("div");
  const b = document.createElement("div");
  const disposeA = mount(a, make);
  const disposeB = mount(b, make);
  disposeA();
  request.resolve("ready");
  await tick();
  expect(a.textContent).toBe("");
  expect(b.textContent).toBe("ready");
  expect(calls).toBe(1);
  disposeB();
});
it("runs effect cleanup after committed rendering and once at disposal", async () => {
  const { mount, element, append, text } = await import("../src/addons/dom");
  const count = state(1);
  const events: string[] = [];
  const host = document.createElement("div");
  const dispose = mount(host, () => {
    effect(() => {
      const n = count.read();
      events.push(`effect:${n}:${host.textContent}`);
      return () => events.push(`cleanup:${n}:${host.textContent}`);
    });
    return element("output", (el) =>
      append(
        el,
        text(() => count.read()),
      ),
    );
  });
  await tick();
  count.write(2);
  await tick();
  dispose();
  dispose();
  expect(events).toEqual(["effect:1:1", "cleanup:1:2", "effect:2:2", "cleanup:2:2"]);
});
it("retains the old branch when a newly selected branch discovers a pending dependency", async () => {
  const { mount, when, Loading, element, append, text } = await import("../src/addons/dom");
  const selected = state(false);
  const request = deferred<string>();
  const value = awaited(() => request.promise);
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    Loading({
      children: () =>
        when(
          () => selected.read(),
          () =>
            element("b", (el) =>
              append(
                el,
                text(() => value.read()),
              ),
            ),
          () => element("input", () => {}),
        ),
      fallback: () => element("i", () => {}),
    }),
  );
  const input = host.querySelector("input")!;
  input.value = "draft";
  selected.write(true);
  await tick();
  expect(host.querySelector("input")).toBe(input);
  expect(host.querySelector("b")).toBeNull();
  selected.write(false);
  await tick();
  expect(host.querySelector("input")).toBe(input);
  selected.write(true);
  await tick();
  request.resolve("ready");
  await tick();
  expect(host.textContent).toBe("ready");
  expect(host.querySelector("input")).toBeNull();
  dispose();
});
it("stages newly keyed rows until their own dependencies are ready", async () => {
  const { mount, list, Loading, element, append, text } = await import("../src/addons/dom");
  const items = state([1]);
  const request = deferred<string>();
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    Loading({
      children: () =>
        list(
          () => items.read(),
          (id) => id,
          (id) => {
            const value = awaited(() => (id() === 1 ? "one" : request.promise));
            return element("p", (el) =>
              append(
                el,
                text(() => value.read()),
              ),
            );
          },
        ),
      fallback: () => element("i", () => {}),
    }),
  );
  const first = host.querySelector("p");
  items.write([1, 2]);
  await tick();
  expect(host.querySelectorAll("p")).toHaveLength(1);
  expect(host.querySelector("p")).toBe(first);
  request.resolve("two");
  await tick();
  expect(host.textContent).toBe("onetwo");
  expect(host.querySelector("p")).toBe(first);
  dispose();
});
