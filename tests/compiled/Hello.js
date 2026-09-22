import * as $$dom from "publr/dom";
export function Hello() {
  function greet() {
    alert("Hello from Publr");
  }

  return $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", greet); $$dom.append($$domElement, $$dom.literal("Hello")); });
}
