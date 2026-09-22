import { mount } from "publr/dom";
// @ts-expect-error Generated PTSX components.
import * as Focused from "../../.generated/app/components/FocusedInspector.js";
const host = document.getElementById("example")!;
const initialHTML = JSON.parse(document.getElementById("response-html")!.textContent!) as string;
const files = Array.from(
  document.querySelectorAll<HTMLOptionElement>("#source-file option"),
  (option) => ({ name: option.value, label: option.textContent! }),
);
const inspector = document.querySelector<HTMLElement>(".inspection-panel")!;
const controls = document.getElementById("example-controls")!;
const label = document.getElementById("start")!.textContent!;
const entries = {
  ssr: () => import("../../examples/ssr"),
  html: () => import("../../examples/html"),
  dom: () => import("../../examples/dom"),
  async: () => import("../../examples/async"),
  query: () => import("../../examples/query"),
  navigation: () => import("../../examples/navigation"),
};
const lesson = document.body.dataset.lesson as keyof typeof entries;

inspector.replaceChildren();
controls.replaceChildren();
const disposeInspector = mount(inspector, Focused.FocusedInspector, { initialHTML, files });
const disposeControls = mount(controls, Focused.FocusedControls, {
  label,
  initiallyEmpty: !initialHTML.trim(),
  start: async () => (await entries[lesson]()).start(host),
});
window.addEventListener(
  "pagehide",
  () => {
    disposeInspector();
    disposeControls();
  },
  { once: true },
);
