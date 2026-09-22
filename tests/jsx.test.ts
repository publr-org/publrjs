// Verify the algorithms shared by specialized compiler output.
import { expect, it } from "vitest";
import {
  element,
  append,
  literal,
  attr,
  event,
  mount,
  when,
  list,
  text,
  styles,
  reference,
} from "../src/addons/dom";
import { state, effect } from "../src/runtime";
import { tick } from "./helpers";

it("applies property, ARIA, style, and event writes and retires their owner", async () => {
  const value = state("first");
  const checked = state(false);
  let events = 0;
  let ref: Element | null = null;
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    element("input", (el) => {
      attr(el, "value", () => value.read());
      attr(el, "checked", () => checked.read());
      attr(el, "aria-busy", () => checked.read());
      styles(el, () => ({ color: checked.read() ? "red" : null }));
      event(el, "input", () => events++);
      reference(el, (el) => {
        ref = el;
      });
    }),
  );
  const input = host.querySelector("input")!;
  expect(ref).toBe(input);
  expect(input.value).toBe("first");
  checked.write(true);
  value.write("next");
  await tick();
  expect(input.checked).toBe(true);
  expect(input.getAttribute("aria-busy")).toBe("true");
  expect(input.style.color).toBe("red");
  input.dispatchEvent(new Event("input"));
  expect(events).toBe(1);
  dispose();
  expect(ref).toBeNull();
  value.write("disposed");
  input.dispatchEvent(new Event("input"));
  await tick();
  expect(events).toBe(1);
  expect(input.value).toBe("next");
});
it("disposes conditional owners and preserves active branch identity", async () => {
  const visible = state(true);
  const label = state("one");
  let effects = 0;
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    when(
      () => visible.read(),
      () => {
        effect(() => {
          label.read();
          effects++;
        });
        return element("b", (el) =>
          append(
            el,
            text(() => label.read()),
          ),
        );
      },
      () => element("i", (el) => append(el, literal("hidden"))),
    ),
  );
  await tick();
  const bold = host.querySelector("b");
  label.write("two");
  await tick();
  expect(host.querySelector("b")).toBe(bold);
  visible.write(false);
  await tick();
  const before = effects;
  label.write("three");
  await tick();
  expect(effects).toBe(before);
  expect(host.textContent).toBe("hidden");
  dispose();
});
it("updates nested keyed lists when replacement objects retain keys", async () => {
  const data = state([{ id: 1, rows: [{ id: "a", title: "first" }] }]);
  const host = document.createElement("div");
  const dispose = mount(host, () =>
    list(
      () => data.read(),
      (x) => x.id,
      (group) =>
        element("section", (el) =>
          append(
            el,
            list(
              () => group().rows,
              (x) => x.id,
              (row) =>
                element("b", (el) =>
                  append(
                    el,
                    text(() => row().title),
                  ),
                ),
            ),
          ),
        ),
    ),
  );
  const bold = host.querySelector("b");
  data.write([
    {
      id: 1,
      rows: [
        { id: "a", title: "updated" },
        { id: "b", title: "new" },
      ],
    },
  ]);
  await tick();
  expect(host.querySelector("b")).toBe(bold);
  expect(host.textContent).toBe("updatednew");
  dispose();
});
it("creates deferred branch nodes in the host document", async () => {
  const other = document.implementation.createHTMLDocument();
  const host = other.createElement("div");
  const open = state(false);
  const dispose = mount(host, () =>
    when(
      () => open.read(),
      () => element("b", (el) => append(el, literal("other"))),
    ),
  );
  open.write(true);
  await tick();
  expect(host.querySelector("b")?.ownerDocument).toBe(other);
  dispose();
});
