import source from "../../examples/components/ResilientSearch.ptsx?raw";
import domSource from "../../.generated/components/ResilientSearch.js?raw";
import publicDOM from "../snippets/failure-dom.js.txt?raw";
import storeSource from "../snippets/failure-store.js.txt?raw";
import publicHTML from "../snippets/failure-store.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

const endpoint = domSource.match(/"(\/_publr\/[^"\s]+\/findPeople)"/)?.[1];
if (!endpoint) throw new Error("Missing generated people endpoint");
const requestSource = `import { operation } from "publr/transport";

export function findPeople(search) {
  return operation(${JSON.stringify(endpoint)}, [search]);
}`;
setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  awaitedLesson: { failure: true, requestSource, storeSource, publicHTML, publicDOM },
});
