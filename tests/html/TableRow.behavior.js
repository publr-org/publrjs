import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";

export function TableRow() {
  let count = $$publr.state(0, "count@66");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment: increment});
return $$html.template("<tr><td><button data-p-on=\"click:increment\">+</button></td><td data-p-text=\"$v184\"></td></tr>", {"v184": () => count.read()}, {"increment": (_dataset, {event}) => increment(event)}, [], {});
}

$$html.register("TableRow_ef31a74dee07af52", TableRow);
