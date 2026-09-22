// @ts-expect-error Generated PTSX module.
import { EffectCounter } from "../.generated/components/EffectCounter.js";
import { activate, destroy } from "publr";
import { mount } from "publr/dom";
import "../.generated/components/EffectCounter.behavior.js";

const host = document.getElementById("preview")!;
const title = document.getElementById("tab-title")!;
const syncTitle = () => {
  title.textContent = document.title;
};
const observer = new MutationObserver(syncTitle);
observer.observe(document.querySelector("title")!, { childList: true });
syncTitle();
let stop: (() => void) | undefined;
function start() {
  if (stop) return;
  if (host.querySelector("#app"))
    stop = mount(host.querySelector<HTMLElement>("#app")!, EffectCounter);
  else {
    activate(host);
    stop = () => destroy(host);
  }
  document.body.dataset.ready = "true";
}
window.addEventListener("message", (event) => {
  if (
    event.source === parent &&
    event.origin === new URL(document.baseURI).origin &&
    event.data === "publr:start-effect-demo"
  )
    start();
});
if (document.body.dataset.start === "true") start();
window.addEventListener("pagehide", () => {
  stop?.();
  observer.disconnect();
});
