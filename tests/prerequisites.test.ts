import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  state as handle,
  createStoreContainer,
  createLocalStore,
  hydrate as scan,
  activate,
} from "../src/publr";
import { awaited, derived } from "../src/runtime";
import { mount, hydrate, element, append, text, Loading } from "../src/addons/dom";
import { tick, deferred } from "./helpers";
// @ts-expect-error compiled PTSX
import { Helpers } from "./compiled/Helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

it("uses a value handle for primitives, nested mutation and replacement", async () => {
  const count = handle(1);
  count.value++;
  expect(count.value).toBe(2);
  const data = handle({ rows: [{ text: "first" }] });
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("p", (el) =>
      append(
        el,
        text(() => data.value.rows[0].text),
      ),
    ),
  );
  data.value.rows[0].text = "nested";
  await tick();
  expect(host.textContent).toBe("nested");
  data.value = { rows: [{ text: "replacement" }] };
  await tick();
  expect(host.textContent).toBe("replacement");
  dispose();
});

it("activates late local and shared HTML automatically and supports deliberate replay", async () => {
  const clicks = vi.fn();
  const cleanup = vi.fn();
  document.body.innerHTML =
    '<main data-p-activation="manual"><div data-p-store="replay"><button data-p-on="click:go">Hello</button></div></main>';
  const button = document.querySelector("button")!;
  createLocalStore("replay", () => ({ actions: { go: clicks }, init: () => cleanup }));
  await tick();
  button.click();
  expect(clicks).not.toHaveBeenCalled();
  activate(document.querySelector("main")!);
  scan(document);
  button.click();
  expect(clicks).toHaveBeenCalledTimes(1);
  expect(document.querySelector("button")).toBe(button);
  document.body.append(button.closest("div")!);
  await tick();
  button.click();
  expect(clicks).toHaveBeenCalledTimes(2);
  button.closest("div")!.remove();
  await tick();
  expect(cleanup).toHaveBeenCalledTimes(1);
  document.body.innerHTML =
    '<article data-p-store="late-scoped"><i data-p-text="name"></i></article>';
  const app = createStoreContainer({ root: document.querySelector("article")! });
  await tick();
  app.createStore("late-scoped", () => ({ state: { name: "ready" } }));
  await tick();
  expect(document.querySelector("i")?.textContent).toBe("ready");
  app.dispose();
});

it("isolates same-name stores, deferred watches, subscriptions, and identical seed IDs", async () => {
  document.body.innerHTML = ["Alice", "Bob"]
    .map(
      (name) =>
        `<section data-p-store="user"><script id="publr-state-user" type="application/json">{"name":"${name}"}</script><b data-p-text="name"></b></section>`,
    )
    .join("");
  const roots = [...document.querySelectorAll("section")];
  const a = createStoreContainer({ root: roots[0] });
  const b = createStoreContainer({ root: roots[1] });
  const seenA = vi.fn(),
    seenB = vi.fn(),
    watchA = vi.fn(),
    watchB = vi.fn();
  a.subscribe("user", seenA);
  b.subscribe("user", seenB);
  const first = a.createStore("user", () => ({ state: { name: "" }, watch: { "*": watchA } }));
  await Promise.resolve();
  const second = b.createStore("user", () => ({ state: { name: "" }, watch: { "*": watchB } }));
  await tick();
  expect([first.name, second.name]).toEqual(["Alice", "Bob"]);
  first.name = "A";
  await tick();
  expect(seenA).toHaveBeenCalledTimes(1);
  expect(seenB).not.toHaveBeenCalled();
  expect(watchA).toHaveBeenCalledTimes(1);
  a.dispose();
  second.name = "B";
  await tick();
  expect(watchB).toHaveBeenCalledTimes(1);
  expect(roots[1].querySelector("b")?.textContent).toBe("B");
  b.dispose();
  const cancelled = createStoreContainer();
  const watcher = vi.fn();
  const old = cancelled.createStore("user", () => ({
    state: { name: "old" },
    watch: { "*": watcher },
  }));
  cancelled.dispose();
  await tick();
  old.name = "after disposal";
  expect(watcher).not.toHaveBeenCalled();
});

it.each([undefined, null, false, 0])(
  "tracks falsy failure %s independently of payload reads",
  async (error) => {
    const request = deferred<null>();
    const value = awaited(() => request.promise);
    expect(value.pending()).toBe(true);
    request.reject(error);
    await tick();
    expect(value.isError()).toBe(true);
    expect(value.error()).toBe(error);
    const computed = derived(() => value.read());
    expect(computed.isError()).toBe(true);
    expect(computed.error()).toBe(error);
    value.refresh();
    expect(value.isError()).toBe(false);
    await tick();
  },
);

it("preserves thrown undefined in Loading's error callback", async () => {
  const request = deferred<string>();
  const host = document.createElement("div");
  const caught = vi.fn();
  const dispose = mount(host, () => {
    const value = awaited(() => request.promise);
    return Loading({
      children: () => text(() => value.read()),
      fallback: () => element("i", () => {}),
      error: (error) => {
        caught(error);
        return element("b", () => {});
      },
    });
  });
  request.reject(undefined);
  await tick();
  expect(caught).toHaveBeenCalledWith(undefined);
  expect(host.querySelector("b")).not.toBeNull();
  dispose();
});

it.each([false, true])(
  "reconciles helpers after native hydration=%s without replacing keyed rows",
  async (native) => {
    const host = document.createElement("div");
    document.body.append(host);
    if (native) host.innerHTML = readFileSync("tests/compiled/Helpers.html", "utf8");
    const original = host.querySelector("ul li");
    const dispose = native
      ? hydrate(host.firstElementChild!, Helpers)
      : mount(host, Helpers, {
          rows: [
            { id: 1, name: "First" },
            { id: 2, name: "Second" },
          ],
        });
    const row = host.querySelector("ul li");
    const paragraph = host.querySelector("p");
    (row as HTMLElement).click();
    await tick();
    expect(row?.getAttribute("data-clicks")).toBe("1");
    if (native) expect(row).toBe(original);
    host.querySelector("button")!.click();
    await tick();
    expect(host.querySelectorAll("ul li")[1]).toBe(row);
    expect(row?.textContent).toBe("2. Updated");
    expect(row?.getAttribute("data-clicks")).toBe("1");
    expect(row?.getAttribute("data-snapshot")).toBe("First");
    expect(host.querySelector("p")).toBe(paragraph);
    expect(paragraph?.textContent).toBe("Updated");
    expect(host.querySelector("ol")?.textContent).toBe("Updated");
    host.querySelectorAll("button")[1].click();
    await tick();
    expect(host.querySelector("p")?.textContent).toBe("Signed out");
    expect(host.querySelector("ul")?.textContent).toBe("Empty");
    expect(host.querySelector("b")?.textContent).toBe("Missing");
    dispose();
  },
);

it("adopts a structural helper root inside tbody and keeps future rows in that parent", async () => {
  // @ts-expect-error compiled PTSX
  const { HelperRoot } = await import("./compiled/HelperRoot.js");
  // happy-dom incorrectly foster-parents templates; the browser suite checks real parsing.
  document.body.innerHTML = `<table><tbody>${readFileSync("tests/compiled/HelperRoot.html", "utf8")}</tbody></table>`;
  const tbody = document.querySelector("tbody")!;
  tbody.prepend(document.querySelector("template[data-p-root-start]")!);
  tbody.append(document.querySelector("template[data-p-root-end]")!);
  const row = document.querySelector("tr");
  const root = document.querySelector("template[data-p-root-start]")!;
  const dispose = hydrate(root, HelperRoot);
  expect(document.querySelector("tr")).toBe(row);
  document.querySelector("button")!.click();
  await tick();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(document.querySelector("tr")).toBe(row);
  dispose();
  expect(document.querySelector("tbody")?.childNodes).toHaveLength(0);
});

it.each([false, true])(
  "owns portal, refs, focus and dismissal with native hydration=%s",
  async (native) => {
    // @ts-expect-error compiled PTSX
    const { Overlay } = await import("./compiled/Overlay.js");
    const host = document.createElement("div");
    document.body.append(host);
    if (native) host.innerHTML = readFileSync("tests/compiled/Overlay.html", "utf8");
    const dispose = native ? hydrate(host.firstElementChild!, Overlay) : mount(host, Overlay);
    const trigger = host.querySelector("button")!;
    trigger.focus();
    trigger.click();
    await tick();
    const panel = document.querySelector("aside")!;
    expect(panel.parentElement?.id).toBe("publr-portal");
    expect(document.activeElement).toBe(panel.querySelector("button"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await tick();
    expect(document.querySelector("aside")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await tick();
    dispose();
    expect(document.querySelector("aside")).toBeNull();
  },
);

it("activates qualified shared references registered after standalone directives", async () => {
  const root = document.createElement("main");
  document.body.append(root);
  const app = createStoreContainer({ root });
  root.innerHTML = '<output data-p-text="$late::value"></output>';
  await tick();
  const store = app.createStore("late", () => ({ state: { value: 4 } }));
  await tick();
  const output = root.querySelector("output")!;
  expect(output.textContent).toBe("4");
  output.remove();
  await tick();
  store.value = 5;
  await tick();
  expect(output.textContent).toBe("4");
  app.dispose();
});
