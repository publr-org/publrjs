// @ts-expect-error Generated PTSX module.
import { ReuseDemo } from "../../.generated/components/ReuseDemo.js";
import source from "../../examples/components/ReuseDemo.ptsx?raw";
import domSource from "../../.generated/components/ReuseDemo.js?raw";
import childSource from "../../examples/components/InstanceCounter.ptsx?raw";
import childDOM from "../../.generated/components/InstanceCounter.js?raw";
import html from "../../.generated/components/ReuseDemo.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/ReuseDemo.behavior.js";

setupWalkthrough({
  Component: ReuseDemo,
  source,
  domSource,
  stateLesson: true,
  reuseLesson: { html, childSource, childDOM },
});
