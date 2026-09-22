import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/dom";




export function Helpers($$domProps0) {
  let rows = $$publr.state($$domProps0.rows, "rows@173");
  let user = $$publr.state($$domProps0.rows[0], "user@205");
  let from = $$publr.state(0, "from@252");
  let search = $$publr.state("", "search@275");
  const filtered = $$publr.derived(() => rows.read().filter((row) => row.name.toLowerCase().includes(search.read().toLowerCase())), "filtered@303");

  function replace() {
    rows.write([{ id: 2, name: "Second" }, { id: 1, name: "Updated" }]);
    user.write(rows.read()[1]);
    from.write(1);
  }

  function hide() {
    user.write(null);
    search.write("missing");
  }

  $$publr.captureActions({replace,hide});
return (
    $$dom.element("section", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", replace); $$dom.append($$domElement, $$dom.literal("Replace")); })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", hide); $$dom.append($$domElement, $$dom.literal("Hide")); })); $$dom.append($$domElement, $$publrDOM.when(() => user.read(), () => $$dom.fragment(() => [$$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => user.read().name)); })]), () => $$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.literal("Signed out")); }), false)); $$dom.append($$domElement, $$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$publrDOM.forEach(() => filtered.read(), (row) => row.id, (row,index) => {
            const snapshot = row().name;
            let clicks = $$publr.state(0, "clicks@988");

            return (
              $$dom.element("li", $$domElement => { $$dom.attr($$domElement, "data-snapshot", () => snapshot); $$dom.attr($$domElement, "data-clicks", () => clicks.read()); $$dom.event($$domElement, "click", (() => clicks.update($$value => { const $$result = $$value++; return [$$value, $$result]; }))); $$dom.append($$domElement, $$dom.insert(() => index() + 1)); $$dom.append($$domElement, $$dom.literal(". ")); $$dom.append($$domElement, $$dom.insert(() => row().name)); })
            );
          }, () => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.literal("Empty")); }), true)); })); $$dom.append($$domElement, $$dom.element("ol", $$domElement => { $$dom.append($$domElement, $$publrDOM.repeat(() => from.read(), () => Math.max(0, Math.min(2, rows.read().length - from.read())), ($$p1) => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => rows.read()[$$p1].name)); }))); })); $$dom.append($$domElement, $$publrDOM.choose([{when: () => user.read(), make: () => $$dom.fragment(() => [$$dom.element("b", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => user.read().name)); })]), keyed: false},{when: () => search.read() === "missing", make: () => $$dom.fragment(() => [$$dom.element("b", $$domElement => { $$dom.append($$domElement, $$dom.literal("Missing")); })]), keyed: false}], () => $$dom.element("b", $$domElement => { $$dom.append($$domElement, $$dom.literal("No match")); }))); })
  );
}
