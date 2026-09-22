// @ts-expect-error Generated PTSX module.
import { StaticPage } from "../../.generated/components/StaticPage.js";
import source from "../../examples/components/StaticPage.ptsx?raw";
import domSource from "../../.generated/components/StaticPage.js?raw";
import childSource from "../../examples/components/StaticGreeting.ptsx?raw";
import childDOM from "../../.generated/components/StaticGreeting.js?raw";
import html from "../../.generated/components/StaticPage.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({
  Component: StaticPage,
  source,
  domSource,
  renderOnly: true,
  compositionLesson: { html, childSource, childDOM },
});
