import writeSource from "../../examples/state/query-write.ts?raw";
import childSource from "../../examples/components/PeopleReader.ptsx?raw";
import childDOM from "../../.generated/components/PeopleReader.js?raw";
import source from "../../examples/components/SharedPeople.ptsx?raw";
import domSource from "../../.generated/components/SharedPeople.js?raw";
import publicDOM from "../snippets/query-dom.js.txt?raw";
import storeSource from "../snippets/query-store.js.txt?raw";
import publicHTML from "../snippets/query-store.html?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

const endpoint = childDOM.match(/"(\/_publr\/[^"\s]+\/readPeople)"/)?.[1];
if (!endpoint) throw new Error("Missing generated people endpoint");
const requestSource = `import { operation } from "publr/transport";

export function readPeople(search) {
  return operation(${JSON.stringify(endpoint)}, [search]);
}

export function peopleKey(search) {
  return [${JSON.stringify(endpoint)}, [search]];
}

${writeSource}`;
setupWalkthrough({
  source,
  domSource,
  stateLesson: true,
  awaitedLesson: {
    query: true,
    requestSource,
    storeSource,
    publicHTML,
    publicDOM,
    files: [
      { name: "SharedPeople.ptsx", source },
      { name: "PeopleReader.ptsx", source: childSource },
      { name: "query-write.ts", source: writeSource },
    ],
  },
});
