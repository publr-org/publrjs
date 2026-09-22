import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import { Counter } from "./Counter.behavior.js";
export function Pair() { return $$html.template("<!--p:html:76--><!--/p:html:76--><!--p:html:99--><!--/p:html:99-->", {}, {}, [$$html.slot(76, () => $$html.child(Counter, {get "initial"() { return 1; }})),$$html.slot(99, () => $$html.child(Counter, {get "initial"() { return 5; }}))], {}); }
