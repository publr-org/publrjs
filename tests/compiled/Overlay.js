import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/dom";
import {ref,effect} from "publr/runtime";
import { trapFocus } from "publr/focus";

export function Overlay() {
  let open = $$publr.state(false, "open@126");
  const panel = ref();
  const trigger = ref();

  function toggle() {
    open.write(!open.read());
  }

  function close() {
    open.write(false);
  }

  effect(() => {
    if (open.read() && panel.current) {
      return trapFocus(panel.current, { restoreFocusEl: trigger.current ?? undefined });
    }
  });

  $$publr.captureActions({toggle,close});
return (
    $$dom.element("section", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.reference($$domElement, trigger); $$dom.event($$domElement, "click", toggle); $$dom.append($$domElement, $$dom.literal("Open")); })); $$dom.append($$domElement, $$publrDOM.when(() => open.read(), () => $$dom.fragment(() => [$$dom.element("aside", $$domElement => { $$dom.reference($$domElement, panel); $$dom.attribute($$domElement, "data-p-portal", true); $$dom.attr($$domElement, "data-p-position", () => ({ anchor: trigger, placement: "bottom-end", offset: 8 })); $$dom.event($$domElement, "dismiss", close); $$dom.attribute($$domElement, "role", "dialog"); $$dom.attribute($$domElement, "aria-label", "Example"); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", close); $$dom.append($$domElement, $$dom.literal("Close")); })); $$dom.enhance($$domElement, ["portal","position"]); })]), undefined, false)); })
  );
}
