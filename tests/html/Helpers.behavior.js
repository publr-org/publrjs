import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/html";




export function Helpers(props) {
  let rows = $$publr.state(props.rows, "rows@173");
  let user = $$publr.state(props.rows[0], "user@205");
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

  $$publr.captureActions({replace: replace,hide: hide});
return (
    $$html.template("<section><button data-p-on=\"click:replace\">Replace</button><button data-p-on=\"click:hide\">Hide</button><!--p:html:726--><!--/p:html:726--><ul><!--p:html:834--><!--/p:html:834--></ul><ol><!--p:html:1253--><!--/p:html:1253--></ol><!--p:html:1414--><!--/p:html:1414--></section>", {}, {"replace": (_dataset, {event}) => replace(event),"hide": (_dataset, {event}) => hide(event)}, [$$html.slot(726, () => $$publrDOM.when(() => user.read(), () => $$html.template("<p data-p-text=\"$v785\"></p>", {"v785": () => user.read().name}, {}, [], {}), () => $$html.template("<p>Signed out</p>", {}, {}, [], {}), false)),$$html.slot(834, () => $$publrDOM.forEach(() => filtered.read(), (row) => row.id, (row,index) => {
            const snapshot = row().name;
            let clicks = $$publr.state(0, "clicks@988");

            return (
              $$html.template("<li data-p-on=\"click:p1043_2\" data-p-bind=\"data-snapshot:$p1043_0;data-clicks:$p1043_1\"><!--p:html:1135--><!--/p:html:1135-->. <!--p:html:1148--><!--/p:html:1148--></li>", {"p1043_0": () => snapshot,"p1043_1": () => clicks.read()}, {"p1043_2": (_dataset, {event}) => (() => clicks.update($$value => { const $$result = $$value++; return [$$value, $$result]; }))(event)}, [$$html.slot(1135, () => index() + 1),$$html.slot(1148, () => row().name)], {})
            );
          }, () => $$html.template("<li>Empty</li>", {}, {}, [], {}), true)),$$html.slot(1253, () => $$publrDOM.repeat(() => from.read(), () => Math.max(0, Math.min(2, rows.read().length - from.read())), (index) => $$html.template("<li data-p-text=\"$v1353\"></li>", {"v1353": () => rows.read()[index].name}, {}, [], {}))),$$html.slot(1414, () => $$publrDOM.choose([{when: () => user.read(), make: () => $$html.template("<b data-p-text=\"$v1480\"></b>", {"v1480": () => user.read().name}, {}, [], {}), keyed: false},{when: () => search.read() === "missing", make: () => $$html.template("<b>Missing</b>", {}, {}, [], {}), keyed: false}], () => $$html.template("<b>No match</b>", {}, {}, [], {})))], {})
  );
}

$$html.register("Helpers_5a3e8e8ffcf6933d", Helpers);
