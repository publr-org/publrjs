import { activate, destroy } from "publr";
import { mount } from "publr/dom";
// @ts-expect-error Generated PTSX module.
import { FocusDetails } from "../.generated/components/FocusDetails.js";
import "../.generated/components/FocusDetails.behavior.js";

const host = document.getElementById("preview")!;
let stop: (() => void) | undefined;
let server = false;
let disposed = false;
function start() {
  if (stop || disposed) return;
  if (server) {
    activate(host);
    stop = () => destroy(host);
  } else stop = mount(host.querySelector<HTMLElement>("#app")!, FocusDetails);
  document.body.dataset.active = "true";
}
window.addEventListener("message", (event) => {
  if (event.source !== parent || event.origin !== location.origin || disposed) return;
  if (event.data?.type === "publr:portal:setup") {
    server = event.data.server;
    host.innerHTML = event.data.html;
    if (event.data.active) start();
    document.body.dataset.loaded = "true";
    parent.postMessage({ type: "publr:portal:loaded" }, location.origin);
  } else if (event.data?.type === "publr:portal:start") start();
});
function dispose() {
  if (disposed) return;
  disposed = true;
  stop?.();
}
window.addEventListener("pagehide", dispose);
window.addEventListener("publr:portal:dispose", dispose);

const status = document.querySelector<HTMLElement>(".focus-status")!;
document.addEventListener("focusin", () => {
  const active = document.activeElement;
  status.textContent =
    active?.tagName === "BUTTON" ? `Focus: ${active.textContent?.trim()}` : "Focus: page";
});
