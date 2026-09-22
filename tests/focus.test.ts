// publr-focus addon: trapFocus — initial focus, Tab/Shift+Tab wrapping,
// release + restore.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { html, $, key } from "./helpers";
import { trapFocus } from "../src/addons/focus";

beforeEach(() => {
  document.body.innerHTML = "";
});

function dialog() {
  html(`
    <button id="outside">outside</button>
    <div id="dialog">
      <button id="first">first</button>
      <input id="mid" />
      <a id="last" href="#">last</a>
    </div>
  `);
  return $("#dialog");
}

describe("trapFocus", () => {
  it("focuses the first focusable element on trap", () => {
    const container = dialog();
    trapFocus(container);
    expect(document.activeElement).toBe($("#first"));
  });

  it("respects opts.initialFocusEl", () => {
    const container = dialog();
    trapFocus(container, { initialFocusEl: $("#mid") });
    expect(document.activeElement).toBe($("#mid"));
  });

  it("wraps Tab from the last element back to the first", () => {
    const container = dialog();
    trapFocus(container);
    $("#last").focus();

    const event = key(container, "keydown", "Tab");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#first"));
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    const container = dialog();
    trapFocus(container);
    $("#first").focus();

    const event = key(container, "keydown", "Tab", { shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#last"));
  });

  it("moves through middle elements in both directions without relying on browser Tab preferences", () => {
    const container = dialog();
    trapFocus(container);
    $("#mid").focus();

    const event = key(container, "keydown", "Tab");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe($("#last"));
    key(container, "keydown", "Tab", { shiftKey: true });
    expect(document.activeElement).toBe($("#mid"));
  });

  it("ignores non-Tab keys", () => {
    const container = dialog();
    trapFocus(container);
    $("#last").focus();

    const event = key(container, "keydown", "Enter");
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe($("#last"));
  });

  it("skips disabled controls and tabindex=-1", () => {
    html(`
      <div id="dialog">
        <button id="dead" disabled>disabled</button>
        <span id="untabbable" tabindex="-1">skip</span>
        <button tabindex="-1">skip button</button>
        <input type="hidden" />
        <div hidden><button>hidden</button></div>
        <div inert><button>inert</button></div>
        <button id="live">live</button>
      </div>
    `);
    trapFocus($("#dialog"));
    expect(document.activeElement).toBe($("#live"));
  });

  it("release() removes the handler and restores previous focus", () => {
    const container = dialog();
    $("#outside").focus();

    const release = trapFocus(container);
    expect(document.activeElement).toBe($("#first"));

    release();
    expect(document.activeElement).toBe($("#outside"));

    $("#last").focus();
    const event = key(container, "keydown", "Tab");
    expect(event.defaultPrevented).toBe(false); // trap no longer active
  });

  it("restores an override instead of the previously focused element", () => {
    const container = dialog();
    $("#outside").focus();
    const target = document.createElement("div");
    target.tabIndex = -1;
    document.body.append(target);
    const release = trapFocus(container, { restoreFocusEl: target });
    release();
    expect(document.activeElement).toBe(target);
  });

  it("preserves the original focus as fallback when the override cannot receive focus", () => {
    const container = dialog();
    $("#outside").focus();
    const target = document.createElement("button");
    document.body.append(target);
    const release = trapFocus(container, { restoreFocusEl: target });
    const focus = vi.spyOn(target, "focus").mockImplementation(() => {});
    $("#last").focus();
    release();
    expect(focus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe($("#outside"));
  });

  it("falls back when an override is detached after opening", () => {
    const container = dialog();
    $("#outside").focus();
    const target = document.createElement("button");
    document.body.append(target);
    const release = trapFocus(container, { restoreFocusEl: target });
    target.remove();
    release();
    expect(document.activeElement).toBe($("#outside"));
  });

  it("is a safe no-op on a container with nothing focusable", () => {
    html(`<button id="outside">o</button><div id="empty"><p>text only</p></div>`);
    $("#outside").focus();

    const release = trapFocus($("#empty"));
    expect(document.activeElement).toBe($("#outside")); // focus untouched
    expect(() => release()).not.toThrow();
  });
});
