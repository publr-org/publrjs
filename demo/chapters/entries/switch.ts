// @ts-expect-error Generated PTSX module.
import { StatusMessage } from "../../.generated/components/StatusMessage.js";
import source from "../../examples/components/StatusMessage.ptsx?raw";
import domSource from "../../.generated/components/StatusMessage.js?raw";
import html from "../../.generated/components/StatusMessage.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/StatusMessage.behavior.js";

setupWalkthrough({
  Component: StatusMessage,
  source,
  domSource,
  stateLesson: true,
  switchLesson: { html },
});
