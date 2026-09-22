import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import {effect} from "publr/runtime";
export function Counter($$domProps0) {
  let count = $$publr.state($$domProps0.initial, "count@108");
  const initial = count.read();
  const doubled = $$publr.derived(() => count.read() * 2, "doubled@171");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment});
return $$dom.element("section", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", increment); $$dom.append($$domElement, $$dom.literal("+")); })); $$dom.append($$domElement, $$dom.element("output", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => count.read())); $$dom.append($$domElement, $$dom.literal(" / ")); $$dom.append($$domElement, $$dom.insert(() => doubled.read())); $$dom.append($$domElement, $$dom.literal(" / ")); $$dom.append($$domElement, $$dom.insert(() => initial)); })); });
}
