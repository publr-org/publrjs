// The DOM target behaves like the wire after activation: merged class stacks,
// a hidden binding that owns the `hidden` class, child arrays with reactive
// thunks, dataset reads from the evaluating element, and rows that keep
// their identity across a source that rebuilds them.
import { beforeEach, expect, it } from "vitest";
import { useClassGroups } from "../src/addons/class-merge";
import {
  element,
  append,
  attr,
  classes,
  insert,
  list,
  literal,
  mount,
  show,
  text,
} from "../src/addons/dom";
import { Publr } from "../src/publr";
import { state } from "../src/runtime";
import { TEST_CLASS_GROUPS, tick } from "./helpers";

beforeEach(() => {
  useClassGroups(TEST_CLASS_GROUPS);
});

it("merges the class stack so a later utility replaces the one it conflicts with", async () => {
  const size = state("px-2");
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("div", (el) => classes(el, () => ["p-4", size.read(), ["w-8"]])),
  );
  const div = host.firstElementChild!;
  expect(div.className).toBe("p-4 px-2 w-8");
  size.write("px-4");
  await tick();
  expect(div.className).toBe("p-4 px-4 w-8");
  dispose();
});

it("toggles the hidden class from a hidden binding and keeps it off across class re-renders", async () => {
  const open = state(false);
  const tone = state("text-sm");
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("div", (el) => {
      classes(el, () => ["hidden", tone.read()]);
      attr(el, "hidden", () => !open.read());
    }),
  );
  const div = host.firstElementChild!;
  expect(div.hasAttribute("hidden")).toBe(true);
  expect(div.classList.contains("hidden")).toBe(true);
  open.write(true);
  await tick();
  expect(div.hasAttribute("hidden")).toBe(false);
  expect(div.classList.contains("hidden")).toBe(false);
  tone.write("text-lg");
  await tick();
  expect(div.className).toBe("text-lg");
  open.write(false);
  await tick();
  expect(div.classList.contains("hidden")).toBe(true);
  dispose();
});

it("keeps a shown element shown when its class stack re-renders", async () => {
  const tone = state("text-sm");
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    show(
      element("div", (el) => classes(el, () => ["hidden", tone.read()])),
      () => true,
    ),
  );
  const div = host.firstElementChild!;
  expect(div.classList.contains("hidden")).toBe(false);
  tone.write("text-lg");
  await tick();
  expect(div.className).toBe("text-lg");
  dispose();
});

it("inserts child arrays, with thunks inside them as their own regions", async () => {
  const count = state(1);
  const label = state("one");
  const host = document.createElement("div");
  let reads = 0;
  const children = [
    literal("a"),
    () => {
      reads++;
      return label.read();
    },
    null,
    false,
    [
      element("b", (el) =>
        append(
          el,
          text(() => count.read()),
        ),
      ),
    ],
  ];
  const dispose = mount(host, () =>
    element("p", (el) =>
      append(
        el,
        insert(() => children),
      ),
    ),
  );
  const p = host.firstElementChild!;
  expect(p.textContent).toBe("aone1");
  const bold = p.querySelector("b");
  label.write("two");
  count.write(2);
  await tick();
  expect(p.textContent).toBe("atwo2");
  expect(p.querySelector("b")).toBe(bold);
  expect(reads).toBe(2);
  dispose();
});

it("treats a fresh array of the same children as the same children", async () => {
  const host = document.createElement("div");
  const items = [literal("x"), literal("y")];
  const pulse = state(0);
  const dispose = mount(host, () =>
    element("p", (el) =>
      append(
        el,
        insert(() => {
          pulse.read();
          return [...items];
        }),
      ),
    ),
  );
  const p = host.firstElementChild!;
  const first = p.firstChild;
  pulse.write(1);
  await tick();
  expect(p.textContent).toBe("xy");
  expect(p.firstChild).toBe(first);
  dispose();
});

it("reads the evaluating element's nearest data attribute", async () => {
  const values = state(["b"]);
  const host = document.createElement("div");
  host.dataset.value = "a";
  const dispose = mount(host, () =>
    element("section", (el) => {
      (el as HTMLElement).dataset.value = "b";
      append(
        el,
        element("button", (el) => {
          attr(el, "aria-expanded", () => values.read().includes(Publr.dataset("value")!));
          attr(el, "data-none", () => Publr.dataset("missing") ?? "none");
        }),
      );
    }),
  );
  const button = host.querySelector("button")!;
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await tick();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(button.getAttribute("data-none")).toBe("none");
  expect(Publr.dataset("value")).toBeUndefined();
  values.write([]);
  await tick();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  dispose();
});

it("keeps rows when the source rebuilds equal objects and updates them when a field changes", async () => {
  const source = state([
    { id: 1, name: "one" },
    { id: 2, name: "two" },
  ]);
  const tickle = state(0);
  const host = document.createElement("div");
  let rendered = 0;
  const dispose = mount(host, () =>
    element("ul", (el) =>
      append(
        el,
        list(
          () => {
            tickle.read();
            return source.read().map((row) => ({ ...row }));
          },
          (row) => row.id,
          (row) =>
            element("li", (el) =>
              append(
                el,
                text(() => {
                  rendered++;
                  return row().name;
                }),
              ),
            ),
        ),
      ),
    ),
  );
  const ul = host.firstElementChild!;
  expect(ul.textContent).toBe("onetwo");
  const [first, second] = ul.children;
  tickle.write(1);
  await tick();
  expect(ul.textContent).toBe("onetwo");
  expect([...ul.children]).toEqual([first, second]);
  source.write([
    { id: 1, name: "uno" },
    { id: 2, name: "two" },
  ]);
  await tick();
  expect(ul.textContent).toBe("unotwo");
  expect([...ul.children]).toEqual([first, second]);
  expect(rendered).toBeLessThan(12);
  dispose();
});
