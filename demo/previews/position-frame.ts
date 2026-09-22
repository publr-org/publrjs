import { activate, destroy } from "publr";
import { mount } from "publr/dom";
// @ts-expect-error Generated PTSX module.
import { AnchoredDetails } from "../.generated/components/AnchoredDetails.js";
import "../.generated/components/AnchoredDetails.behavior.js";

const host = document.getElementById("preview")!;
let stop: (() => void) | undefined;
let server = false;
let disposed = false;
function start() {
  if (stop || disposed) return;
  if (server) {
    activate(host);
    stop = () => destroy(host);
  } else stop = mount(host.querySelector<HTMLElement>("#app")!, AnchoredDetails);
  document.body.dataset.active = "true";
  controls.hidden = false;
  resetScene();
}
window.addEventListener("message", (event) => {
  if (event.source !== parent || event.origin !== location.origin || disposed) return;
  if (event.data?.type === "publr:portal:setup") {
    server = event.data.server;
    host.innerHTML = event.data.html;
    resetScene();
    if (event.data.active) start();
    document.body.dataset.loaded = "true";
    parent.postMessage({ type: "publr:portal:loaded" }, location.origin);
  } else if (event.data?.type === "publr:portal:start") start();
});
function dispose() {
  if (disposed) return;
  disposed = true;
  stop?.();
  placementObserver.disconnect();
}
window.addEventListener("pagehide", dispose);
window.addEventListener("publr:portal:dispose", dispose);

const stage = document.querySelector<HTMLElement>(".position-stage")!;
const controls = document.querySelector<HTMLElement>(".position-controls")!;
const status = document.querySelector<HTMLElement>(".position-status")!;
function moveTrigger(where: string) {
  const trigger = host.querySelector<HTMLElement>(".position-card > button");
  if (!trigger) return;
  const bounds = trigger.getBoundingClientRect();
  const viewport = stage.getBoundingClientRect();
  const top = where === "bottom" ? viewport.bottom - bounds.height - 12 : viewport.top + 100;
  const left = where === "right" ? viewport.right - bounds.width - 12 : viewport.left + 12;
  stage.scrollBy({ top: bounds.top - top, left: bounds.left - left, behavior: "instant" });
}
function resetScene() {
  requestAnimationFrame(() => {
    if (!disposed) moveTrigger("top");
  });
}
for (const button of controls.querySelectorAll<HTMLButtonElement>("button")) {
  button.onclick = () => moveTrigger(button.dataset.move!);
}
const placementObserver = new MutationObserver(() => {
  const panel = document.querySelector<HTMLElement>(".position-panel");
  const placement = panel?.dataset.placement;
  const text =
    !panel || panel.hidden || !placement
      ? "Open details to see its placement."
      : `Panel: ${placement.startsWith("top") ? "above" : "below"} · aligned ${placement.endsWith("end") ? "right" : "left"}`;
  if (status.textContent !== text) status.textContent = text;
});
placementObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden", "data-placement"],
});
