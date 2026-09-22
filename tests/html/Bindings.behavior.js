import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";

export function Bindings() {
  let active = $$publr.state(false, "active@64");
  const toggle = () => { active.write(!active.read()); };
  $$publr.captureActions({toggle: toggle});
return $$html.template("<section data-p-on=\"resize.window:toggle\" data-p-bind=\"class:$p142_class\"><button data-p-on=\"click:toggle;keydown.enter.prevent:toggle\">Toggle</button><output data-p-text=\"$v309\"></output><!--p:html:346--><!--/p:html:346--></section>", {"p142_class": () => $$html.className([["base", active.read() ? "on" : "off"]]),"v309": () => active.read() ? "yes" : "no"}, {"toggle": (_dataset, {event}) => toggle(event),"toggle": (_dataset, {event}) => toggle(event),"toggle": (_dataset, {event}) => toggle(event)}, [$$html.slot(346, () => $$html.when(() => active.read(), () => $$html.template("<p aria-hidden=\"false\">On</p>", {}, {}, [], {}), () => $$html.template("<span>Off</span>", {}, {}, [], {})))], {});
}

$$html.register("Bindings_c69f6f2645d24bcb", Bindings);
