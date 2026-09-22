// @ts-expect-error Generated PTSX module.
import { PropsDemo } from "../../.generated/components/PropsDemo.js";
import source from "../../examples/components/PropsDemo.ptsx?raw";
import domSource from "../../.generated/components/PropsDemo.js?raw";
import html from "../../.generated/components/PropsDemo.html?raw";
import childSource from "../../examples/components/Greeting.ptsx?raw";
import companion from "../../.generated/components/PropsDemo.behavior.js?raw";
import childCompanion from "../../.generated/components/Greeting.behavior.js?raw";
import childDOM from "../../.generated/components/Greeting.js?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/PropsDemo.behavior.js";

setupWalkthrough({
  Component: PropsDemo,
  source,
  domSource,
  companion,
  stateLesson: true,
  propsLesson: { html, childSource, childDOM, childCompanion },
});
