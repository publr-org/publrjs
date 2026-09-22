import * as $$dom from "publr/dom";
import { Counter } from "./Counter.js";

export function StaticShell() {
  return (
    $$dom.element("div", $$domElement => { $$dom.classes($$domElement, () => "static-shell"); $$dom.append($$domElement, $$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.literal("Fixed ")); $$dom.append($$domElement, $$dom.literal(7)); })); $$dom.append($$domElement, $$dom.component(Counter, { initial: 1 })); $$dom.append($$domElement, $$dom.component(Counter, { initial: 5 })); })
  );
}
