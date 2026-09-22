import * as $$dom from "publr/dom";
import { Counter } from "./Counter.js";
import { ui } from "./state";

export function App() {
  return (
    $$dom.element("div", $$domElement => { $$dom.append($$domElement, $$dom.component(Counter, {
	initial: 3,
	get label() {
		return ui.label;
	}
})); })
  );
}
