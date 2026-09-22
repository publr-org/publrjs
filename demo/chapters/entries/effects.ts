import source from "../../examples/components/EffectCounter.ptsx?raw";
import domSource from "../../.generated/components/EffectCounter.js?raw";
import html from "../../.generated/components/EffectCounter.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  effectLesson: { html },
});
