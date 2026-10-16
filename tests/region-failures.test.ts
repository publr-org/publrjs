// Children a component builds once and shows in a branch that comes and goes
// (`{!empty && <div>{children}</div>}` with `children` read where the component
// starts) show again when the branch returns, and the list inside them keeps a
// place to commit into while hidden. One binding that fails in a pass does not
// stop the others: they commit, the failure is thrown after, and the region
// keeps updating.
import { expect, it } from "vitest";
import { append, element, insert, list, mount, text, when } from "../src/addons/dom";
import { state } from "../src/runtime";
import { captureMicrotasks, tick } from "./helpers";

it("shows children built before their branch again after the branch goes and comes back", async () => {
  const shown = state(true);
  const items = state(["a", "b"]);
  const host = document.createElement("div");
  const dispose = mount(host, () => {
    const children = list(
      () => items.read(),
      (item) => item,
      (item) => element("i", (el) => append(el, insert(() => item()))),
    );
    return element("section", (el) =>
      append(
        el,
        when(
          () => shown.read(),
          () => element("div", (div) => append(div, insert(() => children))),
        ),
      ),
    );
  });
  const names = () => [...host.querySelectorAll("i")].map((node) => node.textContent);
  expect(names()).toEqual(["a", "b"]);
  shown.write(false);
  await tick();
  expect(names()).toEqual([]);
  // The list commits while its branch is gone.
  items.write(["c"]);
  await tick();
  expect(names()).toEqual([]);
  shown.write(true);
  items.write(["c", "d"]);
  await tick();
  expect(names()).toEqual(["c", "d"]);
  expect(host.querySelector("div")!.children.length).toBe(2);
  dispose();
});

it("commits the other bindings of a pass when one fails, then throws the failure", () => {
  const micro = captureMicrotasks();
  try {
    const fail = state(false);
    const label = state("one");
    const host = document.createElement("div");
    const dispose = mount(host, () =>
      element("div", (el) =>
        append(
          el,
          when(
            () => true,
            () =>
              element("p", (p) => {
                append(
                  p,
                  text(() => {
                    if (fail.read()) throw new Error("boom");
                    return "ok";
                  }),
                );
                append(
                  p,
                  text(() => label.read()),
                );
              }),
          ),
        ),
      ),
    );
    expect(host.textContent).toBe("okone");
    fail.write(true);
    label.write("two");
    expect(() => micro.runAll()).toThrow("boom");
    expect(host.textContent).toBe("oktwo");
    fail.write(false);
    label.write("three");
    micro.runAll();
    expect(host.textContent).toBe("okthree");
    dispose();
  } finally {
    micro.restore();
  }
});
