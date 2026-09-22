import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { activate, destroy, ref, createLocalStore } from "../src/publr";
import { mount } from "../src/addons/dom";
import { tick } from "./helpers";
// @ts-expect-error compiled PTSX
import { ExplicitOverlay } from "./compiled/ExplicitOverlay.js";
import "./html/ExplicitOverlay.behavior.js";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
afterEach(() => {
  destroy(document.body);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

for (const native of [false, true]) {
  it(`connects explicit refs, selector portals and independent position (${native ? "native" : "DOM"})`, async () => {
    document.body.innerHTML = '<main data-p-activation="manual"></main>';
    const host = document.querySelector("main")!;
    if (native) host.innerHTML = readFileSync("tests/html/ExplicitOverlay.html", "utf8");
    const stop = native ? () => destroy(host) : mount(host, ExplicitOverlay);
    const root = host.querySelector("section")!;
    const anchor = root.querySelectorAll("button")[1];
    const custom = root.querySelector<HTMLElement>(".custom")!;
    const inline = root.querySelector<HTMLElement>(".inline")!;
    const target = root.querySelector("#custom-portal")!;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 140,
      left: 200,
      right: 300,
      width: 100,
      height: 40,
    } as DOMRect);
    for (const panel of [custom, inline])
      vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 60,
        left: 0,
        right: 80,
        width: 80,
        height: 60,
      } as DOMRect);
    activate(host);
    await tick();
    await frame();
    expect(custom.parentElement).toBe(target);
    expect(target.querySelector(".selector")).not.toBeNull();
    expect(document.querySelector("#publr-portal")).toBeNull();
    expect(inline.parentElement).toBe(root);
    expect(custom.style.left).toBe("308px");
    expect(custom.style.top).toBe("100px");
    expect(inline.style.left).toBe("220px");
    expect(inline.style.top).toBe("35px");
    custom.querySelector("button")!.click();
    await tick();
    await frame();
    expect(custom.textContent).toBe("1");
    expect(custom.style.left).toBe("316px");
    stop();
    expect(custom.parentElement).toBe(root);
    expect(root.querySelector(".selector")?.parentElement).toBe(root);
    const stoppedText = custom.textContent;
    custom.querySelector("button")!.click();
    await tick();
    expect(custom.textContent).toBe(stoppedText);
  });
}

it("keeps missing or invalid custom targets in place and reports the error", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  document.body.innerHTML =
    '<main data-p-activation="manual"><aside data-p-portal="#missing"></aside><aside data-p-portal="["></aside></main>';
  const host = document.querySelector("main")!;
  activate(host);
  await tick();
  expect(host.children.length).toBe(2);
  expect(document.querySelector("#publr-portal")).toBeNull();
  expect(error).toHaveBeenCalledTimes(2);
});

it("follows later portal ref assignments and restores the original sibling and styles", async () => {
  const target = ref<HTMLDivElement | null>();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  createLocalStore("late-portal", () => ({ state: { target } }));
  document.body.innerHTML =
    '<main data-p-activation="manual"><section data-p-store="late-portal"><aside data-p-portal data-p-bind="data-p-portal:$target" style="pointer-events:none"></aside><i></i></section><div id="one"></div><div id="two"></div></main>';
  const host = document.querySelector("main")!;
  const root = host.querySelector("section")!;
  const panel = host.querySelector("aside")!;
  activate(host);
  await tick();
  expect(panel.parentElement).toBe(root);
  expect(error).toHaveBeenCalledTimes(1);
  target.current = host.querySelector("#one");
  await tick();
  expect(panel.parentElement?.id).toBe("one");
  target.current = host.querySelector("#two");
  await tick();
  expect(panel.parentElement?.id).toBe("two");
  destroy(root);
  expect(panel.parentElement).toBe(root);
  expect(panel.nextElementSibling?.tagName).toBe("I");
  expect(panel.style.pointerEvents).toBe("none");
  target.current = host.querySelector("#one");
  await tick();
  expect(panel.parentElement).toBe(root);
});

it("activates initially disabled HTML bindings and follows a replacement anchor", async () => {
  const first = ref<HTMLButtonElement | null>();
  const second = ref<HTMLButtonElement | null>();
  createLocalStore("optional-overlay", () => ({
    refs: { first, second },
    state: { enabled: false, position: { anchor: first, placement: "bottom-start", offset: 6 } },
    actions: ({ state }) => ({
      enable() {
        state.enabled = true;
      },
      replace() {
        state.position.anchor = second;
      },
      disable() {
        state.enabled = false;
      },
    }),
  }));
  document.body.innerHTML = `<main data-p-activation="manual"><section data-p-store="optional-overlay">
    <button data-p-ref="first" data-p-on="click:enable">Enable</button>
    <button data-p-ref="second" data-p-on="click:replace">Replace</button>
    <button data-p-on="click:disable">Disable</button>
    <aside data-p-portal data-p-position data-p-bind="data-p-portal:$enabled;data-p-position:$position"></aside>
  </section></main>`;
  const host = document.querySelector("main")!;
  const root = host.querySelector("section")!;
  const buttons = host.querySelectorAll("button");
  const panel = host.querySelector("aside")!;
  for (const [index, button] of [...buttons].entries())
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 140,
      left: 100 + index * 200,
      right: 150 + index * 200,
      width: 50,
      height: 40,
    } as DOMRect);
  activate(host);
  await tick();
  expect(panel.parentElement).toBe(root);
  buttons[0].click();
  await tick();
  await frame();
  expect(panel.parentElement?.id).toBe("publr-portal");
  expect(panel.style.left).toBe("100px");
  buttons[1].click();
  await tick();
  await frame();
  expect(panel.style.left).toBe("300px");
  buttons[2].click();
  await tick();
  expect(panel.parentElement).toBe(root);
});
