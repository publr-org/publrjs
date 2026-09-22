import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { destroy, hydrate } from "../src/publr";
import { tick } from "./helpers";
import "./html/Hello.behavior.js";
import "./html/Counter.behavior.js";
import "./html/Pair.behavior.js";
import "./html/Helpers.behavior.js";
import "./html/HelperRoot.behavior.js";
import "./html/Users.behavior.js";
import "./html/Overlay.behavior.js";
import "./html/StaticShell.behavior.js";
import "./html/ShellOwner.behavior.js";
const html = (name: string) => readFileSync(`tests/html/${name}.html`, "utf8");
const load = (name: string) => {
  document.body.innerHTML = html(name);
  hydrate(document);
};
afterEach(() => {
  destroy(document.body);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("wires native HTML to companion actions without a DOM component", async () => {
  const alert = vi.fn();
  vi.stubGlobal("alert", alert);
  document.body.innerHTML = html("Hello");
  const button = document.querySelector("button")!;
  expect(button.getAttribute("data-p-on")).toMatch(/^click:/);
  hydrate(document);
  button.click();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(document.querySelector("button")).toBe(button);
  const companion = readFileSync("tests/html/Hello.behavior.js", "utf8");
  expect(companion).not.toMatch(/publr\/dom|localComponent|\.\/Hello\.js/);
  await tick();
});
it("restores shared graph values and updates HTML while tolerating extra markup", async () => {
  document.body.innerHTML = html("Counter");
  const root = document.querySelector("section")!;
  root.insertAdjacentHTML("afterbegin", "<aside>Added by a CMS plugin</aside>");
  const button = root.querySelector("button")!;
  const output = root.querySelector("output")!;
  hydrate(document);
  button.click();
  await tick();
  expect(output.textContent).toBe("4 / 8 / 3");
  expect(root.querySelector("button")).toBe(button);
  expect(root.querySelector("aside")?.textContent).toBe("Added by a CMS plugin");
});
it("keeps child component instances independent", async () => {
  load("Pair");
  const buttons = document.querySelectorAll("button");
  buttons[0].click();
  await tick();
  expect([...document.querySelectorAll("output")].map((x) => x.textContent)).toEqual([
    "2 / 4 / 1",
    "5 / 10 / 5",
  ]);
});
it("adopts keyed server rows and keeps row state while replacing objects", async () => {
  load("Helpers");
  const first = document.querySelector("ul li") as HTMLElement;
  first.click();
  await tick();
  expect(first.dataset.clicks).toBe("1");
  document.querySelectorAll("button")[0].click();
  await tick();
  expect(document.querySelectorAll("ul li")[1]).toBe(first);
  expect(first.textContent).toBe("2. Updated");
  expect(first.dataset.clicks).toBe("1");
  expect(first.dataset.snapshot).toBe("First");
  document.querySelectorAll("button")[1].click();
  await tick();
  expect(document.querySelector("ul")?.textContent).toBe("Empty");
  expect(document.querySelector("section")?.textContent).toContain("Signed out");
});
it("adopts root-level table row regions", async () => {
  document.body.innerHTML = `<table><tbody>${html("HelperRoot")}</tbody></table>`;
  const tbody = document.querySelector("tbody")!;
  // happy-dom foster-parents templates; browser validation covers native parsing.
  tbody.prepend(document.querySelector("template[data-p-root-start]")!);
  tbody.append(document.querySelector("template[data-p-root-end]")!);
  hydrate(document);
  document.querySelector("button")!.click();
  await tick();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
});
it("does not refetch transferred async results", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  document.body.innerHTML = html("Users");
  const row = document.querySelector("li")!;
  hydrate(document);
  await tick();
  expect(fetch).not.toHaveBeenCalled();
  expect(document.querySelector("li")).toBe(row);
  expect(row.textContent).toContain("Ada");
});

import { deferred } from "./helpers";
import { register, template, slot, when, Loading, list } from "../src/html";
import { state, awaited } from "../src/core/graph";
import "./html/Fragments.behavior.js";
import "./html/InputRoot.behavior.js";
import "./html/TableRow.behavior.js";
it("keeps handwritten HTML bindings on the companion's named state and actions", async () => {
  load("Counter");
  const root = document.querySelector("section")!;
  root.insertAdjacentHTML(
    "beforeend",
    '<button id="external" data-p-on="click:increment">External</button><b data-p-text="$count"></b>',
  );
  hydrate(root);
  (root.querySelector("#external") as HTMLElement).click();
  await tick();
  expect(root.querySelector("b")?.textContent).toBe("4");
  expect(root.querySelector("output")?.textContent).toBe("4 / 8 / 3");
});
it("updates fragments and detaches listeners on disposal", async () => {
  load("Fragments");
  const button = document.querySelector("button")!;
  const output = document.querySelector("output")!;
  button.click();
  await tick();
  expect(output.textContent).toBe("1");
  destroy(document.body);
  button.click();
  await tick();
  expect(output.textContent).toBe("1");
});
it("keeps focused server rows and drafts during async refresh", async () => {
  const request = deferred<Response>();
  const fetch = vi.fn(() => request.promise);
  vi.stubGlobal("fetch", fetch);
  load("Users");
  const row = document.querySelector("li")!;
  const draft = row.querySelector("input")!;
  draft.value = "draft";
  draft.focus();
  const search = document.querySelector("input")!;
  search.value = "new";
  search.dispatchEvent(new Event("input"));
  await tick();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.querySelector("li")).toBe(row);
  expect(document.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
  request.resolve(
    new Response(
      JSON.stringify([
        { id: 2, name: "New" },
        { id: 1, name: "Updated" },
      ]),
    ),
  );
  await tick();
  await tick();
  expect(document.querySelectorAll("li")[1]).toBe(row);
  expect(row.textContent).toBe("Updated");
  expect(draft.value).toBe("draft");
  expect(document.activeElement).toBe(draft);
});
it("opens and disposes portaled HTML with companion refs and actions", async () => {
  load("Overlay");
  const open = document.querySelector("button")!;
  open.click();
  await tick();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  (dialog.querySelector("button") as HTMLElement).click();
  await tick();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("stages pending branches without replacing the last usable HTML", async () => {
  const selected = state(false),
    request = deferred<string>(),
    value = awaited(() => request.promise);
  register("HTMLPendingBranch", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        Loading({}, () =>
          when(
            () => selected.read(),
            () => template('<b data-p-text="$result"></b>', { result: () => value.read() }),
            () => template("<input>"),
          ),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-html data-p-store="HTMLPendingBranch"><!--p:html:1--><input><!--/p:html:1--></section>';
  hydrate(document);
  const input = document.querySelector("input")!;
  input.value = "draft";
  selected.write(true);
  await tick();
  expect(document.querySelector("input")).toBe(input);
  expect(document.querySelector("b")).toBeNull();
  selected.write(false);
  await tick();
  expect(document.querySelector("input")).toBe(input);
  selected.write(true);
  await tick();
  request.resolve("ready");
  await tick();
  expect(document.querySelector("b")?.textContent).toBe("ready");
  expect(document.querySelector("input")).toBeNull();
});
it("stages newly keyed rows until each row's dependency is ready", async () => {
  const items = state([1]),
    request = deferred<string>();
  register("HTMLPendingRows", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        Loading({}, () =>
          list(
            () => items.read(),
            (id) => id,
            (id) => {
              const value = awaited(() => (id() === 1 ? "one" : request.promise));
              return template('<p data-p-text="$result"></p>', { result: () => value.read() });
            },
          ),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-html data-p-store="HTMLPendingRows"><!--p:html:1--><!--p:row:1--><p data-p-text="$result">one</p><!--/p:row:1--><!--/p:html:1--></section>';
  hydrate(document);
  const first = document.querySelector("p");
  items.write([1, 2]);
  await tick();
  expect(document.querySelectorAll("p")).toHaveLength(1);
  expect(document.querySelector("p")).toBe(first);
  request.resolve("two");
  await tick();
  expect([...document.querySelectorAll("p")].map((x) => x.textContent)).toEqual(["one", "two"]);
});
it("shows a fallback for newly inserted async content, then replaces it", async () => {
  const visible = state(false),
    request = deferred<string>(),
    value = awaited(() => request.promise);
  register("HTMLNewLoading", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        when(
          () => visible.read(),
          () =>
            template("<!--p:html:2--><!--/p:html:2-->", {}, {}, [
              slot(2, () =>
                Loading({ fallback: template("<i>Waiting</i>") }, () =>
                  template('<b data-p-text="$result"></b>', { result: () => value.read() }),
                ),
              ),
            ]),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-html data-p-store="HTMLNewLoading"><!--p:html:1--><!--/p:html:1--></section>';
  hydrate(document);
  visible.write(true);
  await tick();
  expect(document.querySelector("i")?.textContent).toBe("Waiting");
  expect(document.querySelector("b")).toBeNull();
  request.resolve("ready");
  await tick();
  expect(document.querySelector("i")).toBeNull();
  expect(document.querySelector("b")?.textContent).toBe("ready");
});

it("waits for a late structural companion before wiring sibling table controls", async () => {
  // @ts-expect-error Generated PTSX module.
  const { HelperRoot } = await import("./html/HelperRoot.behavior.js");
  document.body.innerHTML = `<table><tbody>${html("HelperRoot").replace(/data-p-store="[^"]+"/, 'data-p-store="LateHTMLTable"')}</tbody></table>`;
  const tbody = document.querySelector("tbody")!;
  tbody.prepend(document.querySelector("template[data-p-root-start]")!);
  tbody.append(document.querySelector("template[data-p-root-end]")!);
  hydrate(document);
  await tick();
  register("LateHTMLTable", HelperRoot);
  document.querySelector("button")!.click();
  await tick();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
});
it("does not activate children before their parent companion arrives", async () => {
  // @ts-expect-error Generated PTSX module.
  const { ShellOwner } = await import("./html/ShellOwner.behavior.js");
  document.body.innerHTML = html("ShellOwner").replace(
    /data-p-store="[^"]+"/,
    'data-p-store="LateHTMLOwner"',
  );
  hydrate(document);
  document.querySelector<HTMLButtonElement>(".static-shell button")!.click();
  await tick();
  expect(document.querySelector("output")?.textContent).toBe("1 / 2 / 1");
  register("LateHTMLOwner", ShellOwner);
  document.querySelector<HTMLButtonElement>(".static-shell button")!.click();
  await tick();
  expect(document.querySelector("output")?.textContent).toBe("2 / 4 / 1");
});

it("creates exactly one child store inside a loading region", async () => {
  const { child } = await import("../src/html");
  let owners = 0;
  const Child = () => {
    owners++;
    return template('<article><b data-p-text="$label"></b></article>', { label: () => "child" });
  };
  register("HTMLCountedChild", Child);
  register("HTMLCountedParent", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        Loading({}, () =>
          template("<div><!--p:html:2--><!--/p:html:2--></div>", {}, {}, [
            slot(2, () => child(Child, {})),
          ]),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-store="HTMLCountedParent"><!--p:html:1--><div><!--p:html:2--><article data-p-store="HTMLCountedChild"><b data-p-text="$label">child</b></article><!--/p:html:2--></div><!--/p:html:1--></section>';
  hydrate(document);
  await tick();
  expect(owners).toBe(1);
  expect(document.querySelector("b")?.textContent).toBe("child");
});

import "./html/Bindings.behavior.js";
it("preserves arrow action names, event modifiers, class layers and new branch attributes", async () => {
  load("Bindings");
  const root = document.querySelector("section")!;
  const button = root.querySelector("button")!;
  expect(root.className).toBe("base off");
  expect(button.getAttribute("data-p-on")).toBe("click:toggle;keydown.enter.prevent:toggle");
  button.click();
  await tick();
  expect(root.className).toBe("base on");
  expect(root.querySelector("p")?.getAttribute("aria-hidden")).toBe("false");
  const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
  button.dispatchEvent(event);
  await tick();
  expect(event.defaultPrevented).toBe(true);
  expect(root.className).toBe("base off");
  window.dispatchEvent(new Event("resize"));
  await tick();
  expect(root.querySelector("output")?.textContent).toBe("yes");
  destroy(document.body);
  window.dispatchEvent(new Event("resize"));
  await tick();
  expect(root.querySelector("output")?.textContent).toBe("yes");
});

it("tracks handwritten class interpolation through the same HTML store", async () => {
  const color = state("red");
  register("HTMLClassTemplate", () =>
    template("<section></section>", { kind: () => "ok", color: () => color.read() }),
  );
  document.body.innerHTML =
    '<section data-p-html data-p-store="HTMLClassTemplate" data-p-class="$kind { ok: x } => { bg-{$color} }"></section>';
  hydrate(document);
  expect(document.querySelector("section")?.className).toBe("bg-red");
  color.write("blue");
  await tick();
  expect(document.querySelector("section")?.className).toBe("bg-blue");
});

it("reuses a named state binding for template text without losing its setter", async () => {
  const { register, template } = await import("../src/html");
  const { state } = await import("../src/runtime");
  register("DirectCountBinding", () => {
    const count = state(0, "count@1");
    return template(
      '<div><output data-p-text="$count"></output><button data-p-on="click:increment">Increment</button><input type="text" data-p-model="count|number"></div>',
      { count: () => count.read() },
      { increment: () => count.write(count.read() + 1) },
    );
  });
  document.body.innerHTML =
    '<div data-p-store="DirectCountBinding" data-p-state=\'{"values":{"count@1":4}}\'><output data-p-text="$count">4</output><button data-p-on="click:increment">Increment</button><input type="text" data-p-model="count|number"></div>';
  const output = document.querySelector("output")!;
  hydrate(document);
  document.querySelectorAll("button")[0].click();
  await tick();
  expect(output.textContent).toBe("5");
  const input = document.querySelector("input")!;
  input.value = "7";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  expect(output.textContent).toBe("7");
  expect(document.querySelector("output")).toBe(output);
});

it("binds an adopted conditional child to its own state before wiring its text", async () => {
  const { child } = await import("../src/html");
  let count = state(1);
  let instances = 0;
  const Child = () => {
    instances++;
    count = state(1, "ticks@1");
    return template('<p><output data-p-text="$ticks"></output></p>', { ticks: () => count.read() });
  };
  register("ConditionalChildState", Child);
  register("ConditionalParentState", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        when(
          () => true,
          () =>
            template("<!--p:html:2--><!--/p:html:2-->", {}, {}, [slot(2, () => child(Child, {}))]),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-html data-p-store="ConditionalParentState"><!--p:html:1--><!--p:when--><!--p:fragment--><!--p:html:2--><p data-p-html data-p-store="ConditionalChildState"><output data-p-text="$ticks">1</output></p><!--/p:html:2--><!--/p:fragment--><!--/p:when--><!--/p:html:1--></section>';
  const output = document.querySelector("output")!;
  hydrate(document);
  await tick();
  expect(instances).toBe(1);
  expect(output.textContent).toBe("1");
  count.write(2);
  await tick();
  expect(document.querySelector("output")).toBe(output);
  expect(output.textContent).toBe("2");
});

it("activates independent children through a plain static shell and disposes them with their owner", async () => {
  for (const name of ["StaticShell", "ShellOwner"]) {
    destroy(document.body);
    document.body.innerHTML = html(name);
    const shell = document.querySelector(".static-shell")!;
    expect(shell.hasAttribute("data-p-store")).toBe(false);
    const buttons = shell.querySelectorAll("button");
    const outputs = shell.querySelectorAll("output");
    hydrate(document);
    buttons[0].click();
    await tick();
    expect([...outputs].map((output) => output.textContent)).toEqual(["2 / 4 / 1", "5 / 10 / 5"]);
    buttons[1].click();
    await tick();
    expect([...outputs].map((output) => output.textContent)).toEqual(["2 / 4 / 1", "6 / 12 / 5"]);
    expect(shell.querySelector("output")).toBe(outputs[0]);
    if (name === "ShellOwner") {
      const toggle = document.querySelector("main > button") as HTMLButtonElement;
      toggle.click();
      await tick();
      expect(document.querySelector(".static-shell")).toBeNull();
      buttons[0].click();
      await tick();
      expect(outputs[0].textContent).toBe("2 / 4 / 1");
      toggle.click();
      await tick();
      expect([...document.querySelectorAll("output")].map((output) => output.textContent)).toEqual([
        "1 / 2 / 1",
        "5 / 10 / 5",
      ]);
    }
  }
});

it("binds scalar row text to its row scope during loading-boundary adoption", async () => {
  const people = state([
    { id: 1, name: "Ada" },
    { id: 2, name: "Elena" },
  ]);
  register("ScalarPeople", () =>
    template("<section><!--p:html:1--><!--/p:html:1--></section>", {}, {}, [
      slot(1, () =>
        Loading({}, () =>
          template("<ul><!--p:html:2--><!--/p:html:2--></ul>", {}, {}, [
            slot(2, () =>
              list(
                () => people.read(),
                (person) => person.id,
                (person) =>
                  template('<li data-p-text="$name"></li>', { name: () => person().name }),
              ),
            ),
          ]),
        ),
      ),
    ]),
  );
  document.body.innerHTML =
    '<section data-p-store="ScalarPeople"><!--p:html:1--><ul><!--p:html:2--><!--p:list--><!--p:row:1--><li data-p-text="$name">Ada</li><!--/p:row:1--><!--p:row:2--><li data-p-text="$name">Elena</li><!--/p:row:2--><!--/p:list--><!--/p:html:2--></ul><!--/p:html:1--></section>';
  const first = document.querySelector("li");
  hydrate(document);
  await tick();
  expect([...document.querySelectorAll("li")].map((el) => el.textContent)).toEqual([
    "Ada",
    "Elena",
  ]);
  people.write([{ id: 1, name: "Ada updated" }]);
  await tick();
  expect(document.querySelector("li")).toBe(first);
  expect(first?.textContent).toBe("Ada updated");
});

it("emits only the store/action relationship for a stateless button", () => {
  const markup = html("Hello");
  document.body.innerHTML = markup;
  const button = document.querySelector("button")!;
  expect(button.getAttributeNames().sort()).toEqual(["data-p-on", "data-p-store"]);
  const alert = vi.fn();
  vi.stubGlobal("alert", alert);
  hydrate(document);
  button.click();
  expect(alert).toHaveBeenCalledTimes(1);
});

it("transfers only props when counter state can be reconstructed", async () => {
  document.body.innerHTML = html("Counter");
  const root = document.querySelector("section")!;
  expect(JSON.parse(root.getAttribute("data-p")!)).toEqual({ $props: { initial: 3 } });
  expect(root.hasAttribute("data-p-state")).toBe(false);
  hydrate(document);
  root.querySelector("button")!.click();
  await tick();
  expect(root.querySelector("output")!.textContent).toBe("4 / 8 / 3");
});

it("uses public state names for transferred async results without refetch", async () => {
  document.body.innerHTML = html("Users");
  const root = document.querySelector("section")!;
  const seed = JSON.parse(root.getAttribute("data-p")!);
  expect(seed.users).toBeInstanceOf(Array);
  expect(Object.keys(seed).some((key) => key.includes("@"))).toBe(false);
  expect(root.hasAttribute("data-p-component")).toBe(false);
  expect(root.hasAttribute("data-p-instance")).toBe(false);
  const fetch = vi.spyOn(globalThis, "fetch");
  const row = root.querySelector("li");
  hydrate(document);
  await tick();
  expect(fetch).not.toHaveBeenCalled();
  expect(root.querySelector("li")).toBe(row);
});
