import source from "../../examples/components/PersonDetails.ptsx?raw";
import domSource from "../../.generated/components/PersonDetails.js?raw";
import publicHTML from "../snippets/portals-store.html?raw";
import storeSource from "../snippets/portals-store.js.txt?raw";
import publicDOM from "../snippets/portals-dom.js.txt?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  portalLesson: { publicHTML, storeSource, publicDOM },
});
