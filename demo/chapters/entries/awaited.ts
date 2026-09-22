import source from "../../examples/components/PeopleSearch.ptsx?raw";
import domSource from "../../.generated/components/PeopleSearch.js?raw";
import publicDOM from "../snippets/awaited-dom.js.txt?raw";
import storeSource from "../snippets/awaited-store.js.txt?raw";
import publicHTML from "../snippets/awaited-store.html?raw";
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
  awaitedLesson: { requestSource, storeSource, publicHTML, publicDOM },
});
