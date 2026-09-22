import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/dom";


export function HelperRoot() {
  let rows = $$publr.state([{ id: 1, name: "One" }], "rows@74");

  function add() {
    rows.write([...rows.read(), { id: 2, name: "Two" }]);
  }

  $$publr.captureActions({add});
return $$publrDOM.forEach(() => rows.read(), (row) => row.id, ($$domProps0) => (
        $$dom.element("tr", $$domElement => { $$dom.append($$domElement, $$dom.element("td", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => $$domProps0().name)); })); $$dom.append($$domElement, $$dom.element("td", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", add); $$dom.append($$domElement, $$dom.literal("Add")); })); })); })
      ), undefined, true);
}
