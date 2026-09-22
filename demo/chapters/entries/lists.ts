// @ts-expect-error Generated PTSX module.
import { ItemList } from "../../.generated/components/ItemList.js";
import source from "../../examples/components/ItemList.ptsx?raw";
import domSource from "../../.generated/components/ItemList.js?raw";
import html from "../../.generated/components/ItemList.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/ItemList.behavior.js";

setupWalkthrough({
  Component: ItemList,
  source,
  domSource,
  stateLesson: true,
  listLesson: { html },
});
