import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import * as $$publrDOM from "publr/html";
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

  $$publr.captureActions({toggle: toggle,close: close});
return (
    $$html.template("<section><button data-p-ref=\"p500_0\" data-p-on=\"click:toggle\">Open</button><!--p:html:559--><!--/p:html:559--></section>", {}, {"toggle": (_dataset, {event}) => toggle(event)}, [$$html.slot(559, () => $$publrDOM.when(() => open.read(), () => $$html.template("<aside data-p-ref=\"p586_0\" data-p-portal data-p-position role=\"dialog\" aria-label=\"Example\" data-p-on=\"dismiss:close\" data-p-bind=\"data-p-position:$p586_2\"><button data-p-on=\"click:close\">Close</button></aside>", {"p586_2": () => ({ anchor: trigger, placement: "bottom-end", offset: 8 })}, {"close": (_dataset, {event}) => close(event),"close": (_dataset, {event}) => close(event)}, [], {"p586_0": panel}), undefined, false))], {"p500_0": trigger})
  );
}

$$html.register("Overlay_ac1e1ab7a3603ba9", Overlay);
