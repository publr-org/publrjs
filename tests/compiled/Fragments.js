import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";

export function Fragments() {
  let count = $$publr.state(0, "count@67");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment});
return $$dom.element("p-fragment", $$domElement => { $$dom.attribute($$domElement, "style", "display:contents"); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", increment); $$dom.append($$domElement, $$dom.literal("+")); })); $$dom.append($$domElement, $$dom.fragment(() => [$$dom.element("output", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => count.read())); })])); });
}
