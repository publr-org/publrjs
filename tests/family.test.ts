// A family root's module-level store is one instance per rendered root. The
// compiler wraps the declarations in a factory and forwards the exports as
// stand-ins; this exercises that shape by hand: two roots in one document,
// parts that read and act on the root above them, and a part without a root.
import { expect, it } from "vitest";
import {
  element,
  append,
  attr,
  component,
  event,
  family,
  mount,
  reference,
  text,
} from "../src/addons/dom";
import { reactive } from "../src/core/reactive";
import { ref } from "../src/core/ref";
import { tick } from "./helpers";

// What `pjsx dom` emits for a root module that exports `state`, a ref and actions.
const $$family = family("Disclosure", () => {
  const state = reactive({ open: false, toggles: 0 });
  const root = ref();
  const toggle = () => {
    state.toggles++;
    state.open = !state.open;
  };
  return { state, root, toggle };
});
const state = $$family.field("state");
const root = $$family.field("root");
const toggle = $$family.action("toggle");

// Children arrive as a getter the root reads inside its own scope, as compiled.
const Disclosure = $$family.root(function Disclosure({
  startOpen,
  children,
}: {
  startOpen: boolean;
  readonly children: Node[];
}) {
  const { state, root } = $$family.current();
  state.open = startOpen;
  return element("div", (el) => {
    attr(el, "data-open", () => String(state.open));
    reference(el, root);
    for (const child of children) append(el, child);
  });
});
const part = (startOpen: boolean, make: () => Node) =>
  component(Disclosure, {
    startOpen,
    get children() {
      return [make()];
    },
  });
function DisclosureButton() {
  return element("button", (el) => {
    attr(el, "aria-expanded", () => state.open);
    event(el, "click", toggle);
    append(
      el,
      text(() => `${state.toggles}`),
    );
  });
}

it("gives every root its own store and resolves the parts through their root", async () => {
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("main", (el) => {
      append(
        el,
        part(true, () => component(DisclosureButton, {})),
      );
      append(
        el,
        part(false, () => component(DisclosureButton, {})),
      );
    }),
  );
  await tick();
  const [first, second] = [...host.querySelectorAll("div")];
  const [firstButton, secondButton] = [...host.querySelectorAll("button")];
  expect(first.dataset.open).toBe("true");
  expect(second.dataset.open).toBe("false");
  expect(firstButton.getAttribute("aria-expanded")).toBe("true");
  expect(secondButton.getAttribute("aria-expanded")).toBe("false");
  secondButton.click();
  await tick();
  expect(second.dataset.open).toBe("true");
  expect(secondButton.getAttribute("aria-expanded")).toBe("true");
  expect(secondButton.textContent).toBe("1");
  expect(first.dataset.open).toBe("true");
  expect(firstButton.textContent).toBe("0");
  dispose();
});

it("hands a ref its own root's element", async () => {
  const seen: Element[] = [];
  const Probe = () =>
    element("span", (el) => {
      attr(el, "data-root", () => {
        const current = (root as unknown as { current: Element | null }).current;
        if (current) seen.push(current);
        return current?.tagName ?? "";
      });
    });
  const host = document.createElement("div");
  const dispose = mount(host, () => part(false, () => component(Probe, {})));
  await tick();
  expect(host.querySelector("span")!.dataset.root).toBe("DIV");
  expect(seen[0]).toBe(host.querySelector("div"));
  dispose();
});

it("keeps a part without a root on one shared instance", async () => {
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("p", (el) => {
      append(el, component(DisclosureButton, {}));
      append(el, component(DisclosureButton, {}));
    }),
  );
  const [a, b] = [...host.querySelectorAll("button")];
  a.click();
  await tick();
  expect(a.getAttribute("aria-expanded")).toBe("true");
  expect(b.getAttribute("aria-expanded")).toBe("true");
  dispose();
});
