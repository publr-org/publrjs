import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/dom";

import { StaticShell } from "./StaticShell.js";

export function ShellOwner() {
  let visible = $$publr.state(true, "visible@125");
  function toggle() { visible.write(!visible.read()); }
  $$publr.captureActions({toggle});
return (
    $$dom.element("main", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", toggle); $$dom.append($$domElement, $$dom.literal("Toggle shell")); })); $$dom.append($$domElement, $$publrDOM.when(() => visible.read(), () => $$dom.fragment(() => [$$dom.component(StaticShell, {})]), undefined, false)); })
  );
}
