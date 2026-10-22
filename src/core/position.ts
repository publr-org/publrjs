import { position, type Placement, type PositionOptions } from "../addons/position";
import { namesOf } from "../addons/class-merge";
import { onCleanup, postEffect } from "./reactivity";
import type { PublrElement } from "./types";
import { directiveValue } from "./directive-value";
import { resolveTarget, type ElementTarget } from "./portal";

export interface PositionBinding extends PositionOptions {
  anchor: ElementTarget;
}

const raf = (view: Window, callback: FrameRequestCallback): number =>
  typeof view.requestAnimationFrame === "function"
    ? view.requestAnimationFrame(callback)
    : (view.setTimeout(() => callback(Date.now()), 0) as unknown as number);

const cancelRaf = (view: Window, handle: number): void => {
  if (typeof view.cancelAnimationFrame === "function") view.cancelAnimationFrame(handle);
  else view.clearTimeout(handle);
};

const authoredParent = (element: PublrElement): Element | null => {
  const saved = element._pp?.[0];
  return saved?.nodeType === Node.ELEMENT_NODE ? (saved as Element) : element.parentElement;
};

/** The trigger a floating part opens from: the first `data-p-anchor` around where it was
 * written, looking out from its authored parent through any wrappers a condition left
 * (a branch nested in another is wrapped in a span) up to its family's root, never past
 * it, so a menu never takes another menu's trigger. */
const authoredAnchor = (element: PublrElement): Element | null => {
  for (let at = authoredParent(element); at; at = at.parentElement) {
    const found = at.querySelector("[data-p-anchor]");
    if (found) return found;
    if (at.hasAttribute("data-p-store")) return null;
  }
  return null;
};

/** `node` is `root` or inside it as authored: a portaled element (a submenu moved to the
 * body) counts as inside the element it was written in, so a press in it is not outside. */
const within = (root: Node, node: Node): boolean => {
  for (let at: Node | null = node; at; at = ((at as PublrElement)._pp?.[0] as Node | null | undefined) ?? at.parentNode)
    if (at === root) return true;
  return false;
};

export const wirePosition = (element: Element, attr: string): void => {
  const floating = element as PublrElement;
  const doc = floating.ownerDocument;
  const view = doc.defaultView ?? window;
  let anchor: Element | null = null;
  let options: PositionOptions = {};
  let enabled = true;
  let frame = 0;

  const isVisible = (): boolean =>
    !floating.hidden && !namesOf("hidden").every((name) => floating.classList.contains(name));

  const dismiss = (reason: "pointer" | "escape"): void => {
    floating.dispatchEvent(new CustomEvent("dismiss", { cancelable: true, detail: { reason } }));
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!isVisible() || !(event.target instanceof Node)) return;
    if (enabled && !within(floating, event.target) && !anchor?.contains(event.target))
      dismiss("pointer");
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (enabled && isVisible() && event.key === "Escape") dismiss("escape");
  };

  const update = (): void => {
    frame = 0;
    if (!enabled || !isVisible()) return;

    if (!anchor) return;

    floating.style.setProperty("--publr-anchor-width", `${anchor.getBoundingClientRect().width}px`);
    const gap = options.offset ?? 4;
    const padding = options.viewportPadding ?? 8;
    floating.style.setProperty(
      "--publr-available-height",
      `${Math.max(0, view.innerHeight - padding * 2)}px`,
    );
    const preferred = position(floating, anchor, options);
    const anchorRect = anchor.getBoundingClientRect();
    const availableHeight = preferred.startsWith("top")
      ? anchorRect.top - gap - padding
      : preferred.startsWith("bottom")
        ? view.innerHeight - padding - anchorRect.bottom - gap
        : view.innerHeight - padding * 2;
    floating.style.setProperty("--publr-available-height", `${Math.max(0, availableHeight)}px`);
    const used = position(floating, anchor, {
      ...options,
      placement: preferred as Placement,
      flip: false,
    });
    floating.dataset.placement = used;
  };

  const schedule = (): void => {
    if (frame) return;
    frame = raf(view, update);
  };

  // Shown or changed: placed now, before the next paint or pointer event, so it is never
  // seen (or hovered) where it stood unplaced for a frame.
  const observer = new view.MutationObserver(() => {
    configure();
    if (frame) cancelRaf(view, frame);
    update();
  });
  observer.observe(floating, {
    attributes: true,
    attributeFilter: ["hidden", "class", attr],
  });
  const resizeObserver =
    typeof view.ResizeObserver === "function" ? new view.ResizeObserver(schedule) : null;
  resizeObserver?.observe(floating);
  const configure = postEffect(() => {
    const value = directiveValue(floating, attr);
    enabled = value != null && value !== false;
    const explicit =
      typeof value === "object" && value !== null ? (value as PositionBinding) : null;
    const nextAnchor = explicit
      ? resolveTarget(floating, explicit.anchor)
      : authoredAnchor(floating);
    if (anchor !== nextAnchor) {
      if (anchor) resizeObserver?.unobserve(anchor);
      anchor = nextAnchor;
      if (anchor) resizeObserver?.observe(anchor);
    }
    const offset = Number.parseFloat(floating.dataset.publrPositionOffset ?? "4");
    options = {
      placement: value === "right" ? "bottom-end" : "bottom-start",
      offset: Number.isFinite(offset) ? offset : 4,
      flip: true,
      flipAlignment: true,
      shift: true,
      viewportPadding: 8,
      ...explicit,
    };
    schedule();
  });
  view.addEventListener("resize", schedule);
  view.addEventListener("scroll", schedule, true);
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("keydown", onKeyDown, true);
  schedule();

  onCleanup(() => {
    if (frame) cancelRaf(view, frame);
    observer.disconnect();
    resizeObserver?.disconnect();
    view.removeEventListener("resize", schedule);
    view.removeEventListener("scroll", schedule, true);
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("keydown", onKeyDown, true);
  });
};
