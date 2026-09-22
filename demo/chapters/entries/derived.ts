// @ts-expect-error Generated PTSX module.
import { DerivedCounter } from "../../.generated/components/DerivedCounter.js";
import domSource from "../../.generated/components/DerivedCounter.js?raw";
import source from "../../examples/components/DerivedCounter.ptsx?raw";
import html from "../../.generated/components/DerivedCounter.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/DerivedCounter.behavior.js";

setupWalkthrough({
  Component: DerivedCounter,
  source,
  domSource,
  stateLesson: true,
  derivedLesson: { html },
});
