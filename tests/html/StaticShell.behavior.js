import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import { Counter } from "./Counter.behavior.js";

export function StaticShell() {
  return (
    $$html.template("<div class=\"static-shell\"><p>Fixed <!--p:html:132--><!--/p:html:132--></p><!--p:html:146--><!--/p:html:146--><!--p:html:176--><!--/p:html:176--></div>", {}, {}, [$$html.slot(132, () => 7),$$html.slot(146, () => $$html.child(Counter, {get "initial"() { return 1; }})),$$html.slot(176, () => $$html.child(Counter, {get "initial"() { return 5; }}))], {})
  );
}
