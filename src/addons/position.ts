// ─────────────────────────────────────────────────────────────────────────────
// PublrJS positioning addon — SOURCE OF TRUTH: publr-js/src/ (TypeScript).
// Built to dist/publr-position.js by Vite, vendored by scripts/vendor-publr.sh.
// Place a floating element relative to an anchor with viewport flip.
// Components that need anchoring `import { position } from
// "./publr-position.js"`; the browser's module cache dedupes it to one load
// per page. No runtime dependency — pure DOM math.
// ─────────────────────────────────────────────────────────────────────────────

type Primary = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

export type Placement =
  | Primary
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"
  | "right-start"
  | "right-end";

export interface PositionOptions {
  placement?: Placement;
  offset?: number;
  flip?: boolean;
  /** Try the opposite start/end alignment when the cross axis collides. */
  flipAlignment?: boolean;
  /** Clamp final coordinates inside the viewport. */
  shift?: boolean;
  /** Viewport gutter used by collision detection and clamping. */
  viewportPadding?: number;
}

const PLACEMENTS: Record<Placement, { primary: Primary; align: Align }> = {
  "top-start": { primary: "top", align: "start" },
  top: { primary: "top", align: "center" },
  "top-end": { primary: "top", align: "end" },
  "bottom-start": { primary: "bottom", align: "start" },
  bottom: { primary: "bottom", align: "center" },
  "bottom-end": { primary: "bottom", align: "end" },
  "left-start": { primary: "left", align: "start" },
  left: { primary: "left", align: "center" },
  "left-end": { primary: "left", align: "end" },
  "right-start": { primary: "right", align: "start" },
  right: { primary: "right", align: "center" },
  "right-end": { primary: "right", align: "end" },
};

const FLIP: Record<Primary, Primary> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

interface Coords {
  top: number;
  left: number;
}

function computeCoords(
  anchorRect: DOMRect,
  floatingRect: DOMRect,
  primary: Primary,
  align: Align,
  offset: number,
): Coords {
  let top!: number;
  let left!: number;

  if (primary === "bottom") {
    top = anchorRect.bottom + offset;
  } else if (primary === "top") {
    top = anchorRect.top - floatingRect.height - offset;
  } else if (primary === "left") {
    left = anchorRect.left - floatingRect.width - offset;
  } else {
    left = anchorRect.right + offset;
  }

  if (primary === "top" || primary === "bottom") {
    if (align === "start") left = anchorRect.left;
    else if (align === "end") left = anchorRect.right - floatingRect.width;
    else left = anchorRect.left + (anchorRect.width - floatingRect.width) / 2;
  } else {
    if (align === "start") top = anchorRect.top;
    else if (align === "end") top = anchorRect.bottom - floatingRect.height;
    else top = anchorRect.top + (anchorRect.height - floatingRect.height) / 2;
  }

  return { top, left };
}

interface Overflow {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Viewport {
  width: number;
  height: number;
}

function overflowAt(
  coords: Coords,
  floatingRect: DOMRect,
  padding: number,
  viewport: Viewport,
): Overflow {
  return {
    top: Math.max(0, padding - coords.top),
    right: Math.max(0, coords.left + floatingRect.width - (viewport.width - padding)),
    bottom: Math.max(0, coords.top + floatingRect.height - (viewport.height - padding)),
    left: Math.max(0, padding - coords.left),
  };
}

const primaryOverflow = (overflow: Overflow, primary: Primary): number => overflow[primary];

const crossOverflow = (overflow: Overflow, primary: Primary): number =>
  primary === "top" || primary === "bottom"
    ? overflow.left + overflow.right
    : overflow.top + overflow.bottom;

const oppositeAlign = (align: Align): Align =>
  align === "start" ? "end" : align === "end" ? "start" : "center";

function clampCoords(
  coords: Coords,
  floatingRect: DOMRect,
  padding: number,
  viewport: Viewport,
): Coords {
  const maxTop = Math.max(padding, viewport.height - padding - floatingRect.height);
  const maxLeft = Math.max(padding, viewport.width - padding - floatingRect.width);
  return {
    top: Math.min(Math.max(coords.top, padding), maxTop),
    left: Math.min(Math.max(coords.left, padding), maxLeft),
  };
}

// Position floating element relative to anchor. Returns the placement actually
// used (may differ from requested if flipped).
export function position(
  floating: HTMLElement,
  anchor: Element,
  opts: PositionOptions = {},
): string {
  const placement = opts.placement || "bottom-start";
  const offset = opts.offset ?? 4;
  const flip = opts.flip !== false;
  const flipAlignment = opts.flipAlignment === true;
  const shift = opts.shift === true;
  const padding = opts.viewportPadding ?? 0;
  const view = floating.ownerDocument.defaultView ?? window;
  const viewport = { width: view.innerWidth, height: view.innerHeight };

  const parsed = PLACEMENTS[placement] || PLACEMENTS["bottom-start"];
  const anchorRect = anchor.getBoundingClientRect();

  floating.style.position = "fixed";
  floating.style.visibility = "hidden";
  floating.style.top = "0";
  floating.style.left = "0";
  const floatingRect = floating.getBoundingClientRect();
  floating.style.visibility = "";

  let { primary, align } = parsed;
  let coords = computeCoords(anchorRect, floatingRect, primary, align, offset);

  if (flip) {
    const flipped = FLIP[primary];
    const flippedCoords = computeCoords(anchorRect, floatingRect, flipped, align, offset);
    const currentOverflow = overflowAt(coords, floatingRect, padding, viewport);
    const flippedOverflow = overflowAt(flippedCoords, floatingRect, padding, viewport);
    if (primaryOverflow(flippedOverflow, flipped) < primaryOverflow(currentOverflow, primary)) {
      primary = flipped;
      coords = flippedCoords;
    }
  }

  if (flipAlignment && align !== "center") {
    const flipped = oppositeAlign(align);
    const flippedCoords = computeCoords(anchorRect, floatingRect, primary, flipped, offset);
    if (
      crossOverflow(overflowAt(flippedCoords, floatingRect, padding, viewport), primary) <
      crossOverflow(overflowAt(coords, floatingRect, padding, viewport), primary)
    ) {
      align = flipped;
      coords = flippedCoords;
    }
  }

  if (shift) coords = clampCoords(coords, floatingRect, padding, viewport);

  floating.style.top = `${coords.top}px`;
  floating.style.left = `${coords.left}px`;

  return align === "center" ? primary : `${primary}-${align}`;
}
