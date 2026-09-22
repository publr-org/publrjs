import * as $$dom from "publr/dom";
import { Counter } from "./Counter.js";
export function Pair() { return $$dom.element("p-fragment", $$domElement => { $$dom.attribute($$domElement, "style", "display:contents"); $$dom.append($$domElement, $$dom.component(Counter, { initial: 1 })); $$dom.append($$domElement, $$dom.component(Counter, { initial: 5 })); }); }
