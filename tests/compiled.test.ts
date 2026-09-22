import { expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { mount, hydrate } from "../src/addons/dom";
import { tick, deferred } from "./helpers";
// @ts-expect-error compiler output
import { Counter } from "./compiled/Counter.js";
// @ts-expect-error compiler output
import { Users } from "./compiled/Users.js";
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
it("executes authored assignments with independent owners, snapshots and derivations", async () => {
  const host = document.createElement("div");
  const dispose = mount(host, Counter, { initial: 3 });
  const second = document.createElement("div");
  const disposeSecond = mount(second, Counter, { initial: 8 });
  expect(host.querySelector("output")?.textContent).toBe("3 / 6 / 3");
  host.querySelector("button")!.click();
  await tick();
  expect(host.querySelector("output")?.textContent).toBe("4 / 8 / 3");
  expect(second.querySelector("output")?.textContent).toBe("8 / 16 / 8");
  dispose();
  disposeSecond();
});
it("hydrates the actual Zig counter output", async () => {
  document.body.innerHTML = readFileSync("tests/compiled/Counter.html", "utf8");
  const host = document.querySelector("[data-p-store]")!;
  expect(host.tagName).toBe("SECTION");
  expect(document.querySelector("p-island, p-fragment")).toBeNull();
  const output = host.querySelector("output");
  const dispose = hydrate(host, Counter);
  host.querySelector("button")!.click();
  await tick();
  expect(host.querySelector("output")).toBe(output);
  expect(output?.textContent).toBe("4 / 8 / 3");
  dispose();
});
it("hydrates a native result without fetching and retains rows during refetch", async () => {
  const request = deferred<Response>();
  const fetch = vi.fn(() => request.promise);
  vi.stubGlobal("fetch", fetch);
  document.body.innerHTML = readFileSync("tests/compiled/Users.html", "utf8");
  const host = document.querySelector("[data-p-store]")!;
  const row = host.querySelector("li")!;
  const draft = row.querySelector("input")!;
  draft.value = "draft";
  draft.focus();
  const dispose = hydrate(host, Users);
  expect(fetch).not.toHaveBeenCalled();
  expect(row.textContent).toBe("Ada </script> & Co");
  const search = host.querySelector("input")!;
  search.value = "new";
  search.dispatchEvent(new Event("input"));
  await tick();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(host.getAttribute("aria-busy")).toBe("true");
  expect(host.querySelector("li")).toBe(row);
  request.resolve(
    new Response(
      JSON.stringify([
        { id: 1, name: "Updated" },
        { id: 2, name: "New" },
      ]),
    ),
  );
  await tick();
  await tick();
  expect(host.querySelectorAll("li")).toHaveLength(2);
  expect(host.querySelector("li")).toBe(row);
  expect(row.textContent).toBe("Updated");
  expect(draft.value).toBe("draft");
  expect(document.activeElement).toBe(draft);
  expect(host.getAttribute("aria-busy")).toBe("false");
  dispose();
});
it("adopts independently seeded nested components and fragments", async () => {
  // @ts-expect-error compiler output
  const { Pair } = await import("./compiled/Pair.js");
  document.body.innerHTML = readFileSync("tests/compiled/Pair.html", "utf8");
  const host = document.querySelector("[data-p-store]")!;
  expect(host.localName).toBe("p-fragment");
  expect(host.querySelectorAll(":scope > section[data-p-store]")).toHaveLength(2);
  const outputs = [...host.querySelectorAll("output")];
  const dispose = hydrate(host, Pair);
  expect(outputs.map((el) => el.textContent)).toEqual(["1 / 2 / 1", "5 / 10 / 5"]);
  host.querySelectorAll("button")[0].click();
  await tick();
  expect([...host.querySelectorAll("output")]).toEqual(outputs);
  expect(outputs.map((el) => el.textContent)).toEqual(["2 / 4 / 1", "5 / 10 / 5"]);
  dispose();
});

it("hydrates void roots without a wrapper or child script and restores escaped state", async () => {
  // @ts-expect-error compiler output
  const { InputRoot } = await import("./compiled/InputRoot.js");
  document.body.innerHTML = readFileSync("tests/compiled/InputRoot.html", "utf8");
  const host = document.body.firstElementChild as HTMLInputElement;
  const dispose = hydrate(host, InputRoot);
  expect(host.tagName).toBe("INPUT");
  expect(host.value).toBe('"<&</script>');
  expect(host.children).toHaveLength(0);
  expect(document.body.children).toHaveLength(1);
  host.value = "updated";
  host.dispatchEvent(new Event("input"));
  await tick();
  expect(document.body.firstElementChild).toBe(host);
  expect(host.value).toBe("updated");
  dispose();
  expect(document.body.children).toHaveLength(0);
});

it("hydrates table rows in their native HTML parent without parser reparenting", async () => {
  // @ts-expect-error compiler output
  const { TableRow } = await import("./compiled/TableRow.js");
  document.body.innerHTML = `<table><tbody>${readFileSync("tests/compiled/TableRow.html", "utf8")}</tbody></table>`;
  const row = document.querySelector("tr")!;
  const dispose = hydrate(row, TableRow);
  row.querySelector("button")!.click();
  await tick();
  expect(row.lastElementChild?.textContent).toBe("1");
  expect(document.querySelector("tbody")?.firstElementChild).toBe(row);
  expect(document.body.children).toHaveLength(1);
  dispose();
});

it("uses p-fragment only for an explicit root fragment in both targets", async () => {
  // @ts-expect-error compiler output
  const { Fragments } = await import("./compiled/Fragments.js");
  const client = document.createElement("div");
  const stopClient = mount(client, Fragments);
  expect(client.querySelectorAll("p-fragment")).toHaveLength(1);
  expect(client.querySelector("p-fragment")?.getAttribute("style")).toBe("display:contents");
  document.body.innerHTML = readFileSync("tests/compiled/Fragments.html", "utf8");
  const root = document.body.firstElementChild!;
  const output = root.querySelector("output");
  const stopServer = hydrate(root, Fragments);
  root.querySelector("button")!.click();
  await tick();
  expect(root.querySelectorAll("p-fragment")).toHaveLength(0);
  expect(root.querySelector("output")).toBe(output);
  expect(output?.textContent).toBe("1");
  stopServer();
  stopClient();
});
it("generated HTML companions expose the same state to handwritten bindings", async () => {
  const { hydrate: hydrateHtml, destroy } = await import("../src/publr");
  // @ts-expect-error generated behavior registration
  await import("./compiled/Counter.behavior.js");
  document.body.innerHTML = readFileSync("tests/compiled/Counter.html", "utf8");
  const host = document.querySelector("[data-p-store]")!;
  hydrateHtml(host);
  const mirror = document.createElement("span");
  mirror.setAttribute("data-p-text", "$count");
  host.appendChild(mirror);
  hydrateHtml(mirror);
  expect(mirror.textContent).toBe("3");
  host.querySelector("button")!.click();
  await tick();
  expect(mirror.textContent).toBe("4");
  expect(host.querySelector("output")?.textContent).toBe("4 / 8 / 3");
  const action = document.createElement("button");
  action.setAttribute("data-p-on", "click:increment");
  host.appendChild(action);
  hydrateHtml(action);
  action.click();
  await tick();
  expect(mirror.textContent).toBe("5");
  expect(host.querySelector("output")?.textContent).toBe("5 / 10 / 3");
  destroy(host);
});

it("nested registered companions do not attach duplicate handlers to component roots", async () => {
  const { hydrate: hydrateHtml, destroy } = await import("../src/publr");
  // @ts-expect-error generated behavior registration
  await import("./compiled/Counter.behavior.js");
  // @ts-expect-error generated behavior registration
  await import("./compiled/Pair.behavior.js");
  document.body.innerHTML = readFileSync("tests/compiled/Pair.html", "utf8");
  const root = document.body.firstElementChild!;
  const listen = vi.spyOn(root.querySelector("button")!, "addEventListener");
  hydrateHtml(root);
  expect(listen.mock.calls.filter(([event]) => event === "click")).toHaveLength(1);
  const counter = root.firstElementChild!;
  const mirror = document.createElement("span");
  mirror.setAttribute("data-p-text", "$count");
  counter.append(mirror);
  hydrateHtml(mirror);
  counter.querySelector("button")!.click();
  await tick();
  expect(counter.querySelector("output")?.textContent).toBe("2 / 4 / 1");
  expect(mirror.textContent).toBe("2");
  destroy(root);
});
