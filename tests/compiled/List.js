import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";

export function List($$domProps0) {
  let items = $$publr.state($$domProps0.items, "items@110");
  return $$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$dom.list(() => items.read(), ($$p1, $i) => $$p1.id, ($$p1, $i) => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => $$p1().name)); }))); });
}
