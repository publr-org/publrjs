// @ts-expect-error Generated PTSX module.
import { SharedCounter } from "../../.generated/components/SharedCounter.js";
// @ts-expect-error Generated PTSX module.
import { StateCounter } from "../../.generated/components/StateCounter.js";
import domSource from "../../.generated/components/SharedCounter.js?raw";
import source from "../../examples/components/SharedCounter.ptsx?raw";
import localDOM from "../../.generated/components/StateCounter.js?raw";
import localSource from "../../examples/components/StateCounter.ptsx?raw";
import storeSource from "../../examples/state/shared-counter.ts?raw";
import html from "../../.generated/components/SharedCounter.html?raw";
import { state, effect } from "publr";
import { mount } from "publr/dom";
// @ts-expect-error Generated PTSX components.
import * as Sharing from "../../.generated/app/components/SharingGuide.js";
import { setupWalkthrough, type LessonOptions } from "../../app/walkthrough/mount";
import "../../.generated/components/SharedCounter.behavior.js";
import "../../.generated/components/StateCounter.behavior.js";

const localLesson = {
  Component: StateCounter,
  source: localSource,
  domSource: localDOM,
  stateLesson: true,
};
const sharedLesson = {
  Component: SharedCounter,
  source,
  domSource,
  sharedLesson: { storeSource, html },
};
const walkthrough = setupWalkthrough(localLesson);
const model = state({ shared: false, busy: false, error: "" }).value;
effect(() => {
  walkthrough.session.compareVisible = model.shared;
});
const controls = document.getElementById("share-count")!.parentElement!;
const explanation = document.getElementById("sharing-explanation")!;
const result = document.getElementById("sharing-result")!;
for (const host of [controls, explanation, result]) host.replaceChildren();
const stops = [
  mount(controls, Sharing.SharingGuide, {
    model,
    localLesson,
    sharedLesson,
    setLesson: (options: LessonOptions, html: string) => walkthrough.setLesson(options, html),
  }),
  mount(explanation, Sharing.SharingExplanation, { model }),
  mount(result, Sharing.SharingResult, { model }),
];
window.addEventListener("pagehide", () => stops.forEach((stop) => stop()), { once: true });
