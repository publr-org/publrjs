// publr-position addon: placement math, alignment, offsets, viewport flip.
// Rects are mocked — happy-dom has no layout engine — so the math is pinned
// against a fixed geometry: viewport 1024x768 (happy-dom default).

import { beforeEach, describe, expect, it } from "vitest";
import { html, $ } from "./helpers";
import { position, type Placement } from "../src/addons/position";

function mockRect(el: Element, rect: Partial<DOMRect>): void {
  const full = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    bottom: (rect.top ?? 0) + (rect.height ?? 0),
    right: (rect.left ?? 0) + (rect.width ?? 0),
    ...rect,
  };
  (el as any).getBoundingClientRect = () => full;
}

let anchor: HTMLElement;
let floating: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  html(`<button id="anchor"></button><div id="float"></div>`);
  anchor = $("#anchor");
  floating = $("#float");
  // anchor: 100x50 at (top 100, left 200) -> bottom 150, right 300
  mockRect(anchor, { top: 100, left: 200, width: 100, height: 50 });
  // floating: 80x40 regardless of where it is
  mockRect(floating, { top: 0, left: 0, width: 80, height: 40 });
});

const px = (v: string) => Number.parseFloat(v);

describe("placement math (offset 4)", () => {
  it.each<[Placement, number, number]>([
    ["bottom-start", 154, 200],
    ["bottom", 154, 210],
    ["bottom-end", 154, 220],
    ["top-start", 56, 200],
    ["top", 56, 210],
    ["top-end", 56, 220],
    ["left-start", 100, 116],
    ["left", 105, 116],
    ["left-end", 110, 116],
    ["right-start", 100, 304],
    ["right", 105, 304],
    ["right-end", 110, 304],
  ])("%s -> top %d, left %d", (placement, top, left) => {
    position(floating, anchor, { placement });
    expect(px(floating.style.top)).toBe(top);
    expect(px(floating.style.left)).toBe(left);
  });

  it("defaults to bottom-start with fixed positioning", () => {
    const used = position(floating, anchor);
    expect(used).toBe("bottom-start");
    expect(floating.style.position).toBe("fixed");
    expect(px(floating.style.top)).toBe(154);
    expect(px(floating.style.left)).toBe(200);
  });

  it("returns the primary alone for center alignment, primary-align otherwise", () => {
    expect(position(floating, anchor, { placement: "top" })).toBe("top");
    expect(position(floating, anchor, { placement: "top-end" })).toBe("top-end");
  });

  it("honors a custom offset", () => {
    position(floating, anchor, { placement: "bottom-start", offset: 12 });
    expect(px(floating.style.top)).toBe(162);
  });

  it("falls back to bottom-start for unknown placements", () => {
    const used = position(floating, anchor, {
      placement: "diagonal" as Placement,
    });
    expect(used).toBe("bottom-start");
  });
});

describe("viewport flip", () => {
  it("flips to the opposite side when the preferred side overflows", () => {
    // anchor near the bottom edge: bottom placement would overflow 768
    mockRect(anchor, { top: 740, left: 200, width: 100, height: 20 });

    const used = position(floating, anchor, { placement: "bottom-start" });
    expect(used).toBe("top-start");
    expect(px(floating.style.top)).toBe(740 - 40 - 4);
  });

  it("keeps the requested side when flip is disabled", () => {
    mockRect(anchor, { top: 740, left: 200, width: 100, height: 20 });

    const used = position(floating, anchor, {
      placement: "bottom-start",
      flip: false,
    });
    expect(used).toBe("bottom-start");
    expect(px(floating.style.top)).toBe(764);
  });

  it("uses the side with less overflow when neither side fully fits", () => {
    // The panel is taller than the viewport, but above leaves more visible.
    mockRect(floating, { width: 80, height: 900 });
    mockRect(anchor, { top: 740, left: 200, width: 100, height: 20 });

    const used = position(floating, anchor, { placement: "bottom-start" });
    expect(used).toBe("top-start");
  });

  it("flips horizontally too (left <-> right)", () => {
    // anchor at the far left: left placement overflows, flips to right
    mockRect(anchor, { top: 300, left: 10, width: 50, height: 20 });

    const used = position(floating, anchor, { placement: "left-start" });
    expect(used).toBe("right-start");
    expect(px(floating.style.left)).toBe(10 + 50 + 4);
  });

  it("restores visibility after measuring", () => {
    position(floating, anchor);
    expect(floating.style.visibility).toBe("");
  });

  it("flips start/end alignment when that resolves horizontal collision", () => {
    mockRect(anchor, { top: 100, left: 10, width: 20, height: 20 });

    const used = position(floating, anchor, {
      placement: "bottom-end",
      flipAlignment: true,
      shift: true,
      viewportPadding: 8,
    });

    expect(used).toBe("bottom-start");
    expect(px(floating.style.left)).toBe(10);
  });

  it("clamps the final panel rectangle to the viewport gutter", () => {
    mockRect(anchor, { top: 100, left: -20, width: 20, height: 20 });

    position(floating, anchor, {
      placement: "bottom-start",
      flipAlignment: true,
      shift: true,
      viewportPadding: 8,
    });

    expect(px(floating.style.left)).toBe(8);
  });
});
