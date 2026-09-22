import { mount } from "publr/dom";
// @ts-expect-error Compiled application UI.
import { CombinedApp } from "../../.generated/app/components/CombinedApp.js";
const host = document.getElementById("combined-app")!;
const initialHTML = document.getElementById("desk")!.innerHTML;
const bridgeHTML = document.getElementById("bridge-template")!.innerHTML;
host.replaceChildren();
const dispose = mount(host, CombinedApp, { interactive: true, initialHTML, bridgeHTML });
window.addEventListener("pagehide", dispose, { once: true });
