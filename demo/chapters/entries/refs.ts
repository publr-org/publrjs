// @ts-expect-error Generated PTSX module.
import { FocusInput } from "../../.generated/components/FocusInput.js";
import source from "../../examples/components/FocusInput.ptsx?raw";
import domSource from "../../.generated/components/FocusInput.js?raw";
import html from "../../.generated/components/FocusInput.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/FocusInput.behavior.js";

setupWalkthrough({
  Component: FocusInput,
  source,
  domSource,
  stateLesson: true,
  refLesson: { html },
});
