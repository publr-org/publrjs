import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/html";

import { StaticShell } from "./StaticShell.behavior.js";

export function ShellOwner() {
  let visible = $$publr.state(true, "visible@125");
  function toggle() { visible.write(!visible.read()); }
  $$publr.captureActions({toggle: toggle});
return (
    $$html.template("<main><button data-p-on=\"click:toggle\">Toggle shell</button><!--p:html:273--><!--/p:html:273--></main>", {}, {"toggle": (_dataset, {event}) => toggle(event)}, [$$html.slot(273, () => $$publrDOM.when(() => visible.read(), () => $$html.template("<!--p:html:294--><!--/p:html:294-->", {}, {}, [$$html.slot(294, () => $$html.child(StaticShell, {}))], {}), undefined, false))], {})
  );
}

$$html.register("ShellOwner_c1a2955b92468c35", ShellOwner);
