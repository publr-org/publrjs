import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import {ref} from "publr/runtime";

export function ExplicitOverlay() {
  const trigger = ref();
  const target = ref();
  let count = $$publr.state(0, "count@163");
  let offset = $$publr.state(8, "offset@187");

  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); offset.write(16); }

  $$publr.captureActions({increment: increment});
return (
    $$html.template("<section class=\"explicit-overlay\"><button data-p-anchor>Decoy</button><button data-p-ref=\"p356_0\">Anchor</button><aside data-p-portal data-p-position class=\"custom\" data-p-bind=\"data-p-portal:$p400_1;data-p-position:$p400_2\"><button data-p-text=\"$v575\" data-p-on=\"click:increment\"></button></aside><aside data-p-portal=\"#custom-portal\" class=\"selector\">Selector</aside><aside data-p-position class=\"inline\" data-p-bind=\"data-p-position:$p684_1\">Inline</aside><div id=\"custom-portal\" data-p-ref=\"p791_1\"></div></section>", {"p400_1": () => target,"p400_2": () => ({ anchor: trigger, placement: "right-start", offset: offset.read(), flip: false, shift: false }),"v575": () => count.read(),"p684_1": () => ({ anchor: trigger, placement: "top-end", offset: 5 })}, {"increment": (_dataset, {event}) => increment(event)}, [], {"p356_0": trigger,"p791_1": target})
  );
}

$$html.register("ExplicitOverlay_b028c1b6c715e05a", ExplicitOverlay);
