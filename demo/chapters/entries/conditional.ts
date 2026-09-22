// @ts-expect-error Generated PTSX module.
import { ConditionalMessage } from "../../.generated/components/ConditionalMessage.js";
import source from "../../examples/components/ConditionalMessage.ptsx?raw";
import domSource from "../../.generated/components/ConditionalMessage.js?raw";
import html from "../../.generated/components/ConditionalMessage.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/ConditionalMessage.behavior.js";

setupWalkthrough({
  Component: ConditionalMessage,
  source,
  domSource,
  stateLesson: true,
  conditionalLesson: { html },
});
