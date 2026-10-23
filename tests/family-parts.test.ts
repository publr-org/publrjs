// A family module's other components reach the module's private values and
// the store of the root they render under, in list rows built later too.
// Runs the actual `pjsx dom` output of tests/compiled/Parts.ptsx.
import { expect, it } from "vitest";
import { append, component, element, family, insert, mount } from "../src/addons/dom";
import { reactive } from "../src/core/reactive";
import { tick } from "./helpers";

const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, "") ?? null;
const click = (node: Element) => node.dispatchEvent(new MouseEvent("click"));

it("gives every part the root's instance and the module's private values", async () => {
  // @ts-expect-error compiler output
  const { Parts, state } = await import("./compiled/Parts.js");
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("main", (main) => {
      append(main, component(Parts, { name: "a" }));
      append(main, component(Parts, { name: "b" }));
    }),
  );
  const [a, b] = [...host.querySelectorAll("section")];
  const items = (root: Element) => [...root.querySelectorAll("button.item")].map(text);
  expect(items(a!)).toEqual(["#1:0"]);
  expect(text(a!.querySelector("p"))).toBe("#0/1");

  click(a!.querySelector("button.add")!);
  await tick();
  expect(items(a!)).toEqual(["#1:0", "#2:0"]);
  expect(items(b!)).toEqual(["#1:0"]);

  // The row built on the update reaches root a's store, not a second instance.
  click(a!.querySelectorAll("button.item")[1]!);
  await tick();
  expect(items(a!)).toEqual(["#1:1", "#2:1"]);
  expect(text(a!.querySelector("p"))).toBe("#1/1");
  expect(items(b!)).toEqual(["#1:0"]);
  expect(text(b!.querySelector("p"))).toBe("#0/1");

  click(b!.querySelector("button.item")!);
  await tick();
  expect(items(b!)).toEqual(["#1:1"]);
  expect(items(a!)).toEqual(["#1:1", "#2:1"]);
  // Outside every root the module's state is the latest mounted root's: b's.
  expect(state.picks).toBe(1);
  dispose();
});

it("mounts a later insert's nodes under the owner, so they reach the root's instance", async () => {
  const $$family = family("Late", () => ({ state: reactive({ count: 7 }) }));
  const state = $$family.field("state");
  const shown = reactive({ on: false });
  const Late = $$family.root(function Late() {
    return element("p", (p) =>
      append(
        p,
        insert(() => (shown.on ? ["count ", () => state.count] : "none")),
      ),
    );
  });
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("main", (main) => {
      append(main, component(Late, {}));
      append(main, component(Late, {}));
    }),
  );
  const [a, b] = [...host.querySelectorAll("p")];
  expect(a!.textContent).toBe("none");
  (state as { count: number }).count = 1; // outside every root: the latest, b
  shown.on = true;
  await tick();
  // a's insert, built after the change, reads a's own instance, not the latest.
  expect(a!.textContent).toBe("count 7");
  expect(b!.textContent).toBe("count 1");
  dispose();
});
