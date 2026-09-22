import source from "../../examples/components/FocusDetails.ptsx?raw";
import domSource from "../../.generated/components/FocusDetails.js?raw";
import publicHTML from "../snippets/focus-store.html?raw";
import storeSource from "../snippets/focus-store.js.txt?raw";
import publicDOM from "../snippets/focus-dom.js.txt?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  portalLesson: { focus: true, publicHTML, storeSource, publicDOM },
});
