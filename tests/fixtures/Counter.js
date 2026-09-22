import * as $$dom from "publr/dom";
import { reactive } from "../../src/publr";

export function Counter({ initial = 0, label = "Count" }) {
  const state = reactive({ count: initial });

  return (
    $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => ["counter", {
	        "counter--active": state.count > 0,
	        "counter--negative": state.count < 0,
	      }]); $$dom.attribute($$domElement, "type", "button"); $$dom.event($$domElement, "click", (() => state.count++)); $$dom.append($$domElement, $$dom.insert(() => label)); $$dom.append($$domElement, $$dom.literal(": ")); $$dom.append($$domElement, $$dom.insert(() => state.count)); })
  );
}
