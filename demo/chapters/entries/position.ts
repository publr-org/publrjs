import source from "../../examples/components/AnchoredDetails.ptsx?raw";
import domSource from "../../.generated/components/AnchoredDetails.js?raw";
import publicHTML from "../snippets/position-store.html?raw";
import storeSource from "../snippets/position-store.js.txt?raw";
import publicDOM from "../snippets/position-dom.js.txt?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  portalLesson: { position: true, publicHTML, storeSource, publicDOM },
});
