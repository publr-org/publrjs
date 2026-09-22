// @ts-expect-error Generated PTSX module.
import { NameInput } from "../../.generated/components/NameInput.js";
import source from "../../examples/components/NameInput.ptsx?raw";
import domSource from "../../.generated/components/NameInput.js?raw";
import html from "../../.generated/components/NameInput.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/NameInput.behavior.js";

setupWalkthrough({
  Component: NameInput,
  source,
  domSource,
  stateLesson: true,
  inputLesson: { html },
});
