import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/html";


export function HelperRoot() {
  let rows = $$publr.state([{ id: 1, name: "One" }], "rows@74");

  function add() {
    rows.write([...rows.read(), { id: 2, name: "Two" }]);
  }

  $$publr.captureActions({add: add});
return $$html.slot(200, () => $$publrDOM.forEach(() => rows.read(), (row) => row.id, (row) => (
        $$html.template("<tr><td data-p-text=\"$v274\"></td><td><button data-p-on=\"click:add\">Add</button></td></tr>", {"v274": () => row().name}, {"add": (_dataset, {event}) => add(event)}, [], {})
      ), undefined, true));
}

$$html.register("HelperRoot_e6bc7a70b92b369f", HelperRoot);
