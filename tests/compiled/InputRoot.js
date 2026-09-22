import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";

export function InputRoot($$domProps0) {
  let value = $$publr.state($$domProps0.initial, "value@93");
  return $$dom.element("input", $$domElement => { $$dom.attr($$domElement, "value", () => value.read()); $$dom.event($$domElement, "input", (event => value.write(event.currentTarget.value))); });
}
