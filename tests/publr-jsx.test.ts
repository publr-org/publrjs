// The authoring face over the DOM target: a polymorphic Dynamic root that
// forwards the caller's ARIA and data props, a Slot that adopts its one child,
// and the two helpers the server renders identically.
import { expect, it } from "vitest";
import * as jsx from "../src/addons/jsx";
import { state } from "../src/runtime";
import { tick } from "./helpers";

it("renders Dynamic as the named tag and forwards the caller's data and aria props", async () => {
  const pressed = state(false);
  const Button = (props: { label: string; children?: unknown }) =>
    jsx.Dynamic({
      as: "button",
      class: "btn",
      get "aria-pressed"() {
        return pressed.read();
      },
      onClick: () => pressed.write(true),
      children: [props.label, ...(Array.isArray(props.children) ? props.children : [])],
    });
  const host = document.createElement("div");
  const dispose = jsx.mount(host, () =>
    jsx.component(Button, {
      label: "Go",
      "data-part": "trigger",
      role: "tab",
      label2: "no",
    } as never),
  );
  const button = host.querySelector("button")!;
  expect(button.className).toBe("btn");
  expect(button.dataset.part).toBe("trigger");
  expect(button.getAttribute("role")).toBe("tab");
  expect(button.hasAttribute("label2")).toBe(false);
  expect(button.textContent).toBe("Go");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  button.click();
  await tick();
  expect(button.getAttribute("aria-pressed")).toBe("true");
  dispose();
});

it("adopts the one authored element through Slot and merges props onto it", () => {
  const host = document.createElement("div");
  const dispose = jsx.mount(host, () =>
    jsx.Slot({
      "data-part": "content",
      children: [jsx.element("a", (el) => jsx.attribute(el, "href", "/x"))],
    }),
  );
  const link = host.querySelector("a")!;
  expect(link.dataset.part).toBe("content");
  expect(link.getAttribute("href")).toBe("/x");
  expect(() => jsx.Slot({ children: ["text"] })).toThrow(/one Element child/);
  dispose();
});

it("derives initials and gravatar urls the way the server does", () => {
  expect(jsx.initials("dawid urbanski")).toBe("DU");
  expect(jsx.initials("  Ada   Lovelace Byron ")).toBe("AL");
  expect(jsx.initials("")).toBe("");
  expect(jsx.gravatarUrl(" MyEmailAddress@example.com ", 80)).toBe(
    "https://gravatar.com/avatar/0bc83cb571cd1c50ba6f3e8a78ef1346?d=blank&s=80",
  );
});

it("exposes the dataset read on the runtime it re-exports", () => {
  expect(jsx.Publr.dataset("anything")).toBeUndefined();
});
