import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";

export function TableRow() {
  let count = $$publr.state(0, "count@66");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment});
return $$dom.element("tr", $$domElement => { $$dom.append($$domElement, $$dom.element("td", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", increment); $$dom.append($$domElement, $$dom.literal("+")); })); })); $$dom.append($$domElement, $$dom.element("td", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => count.read())); })); });
}
