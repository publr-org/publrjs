import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import {effect} from "publr/runtime";
export function Counter(props) {
  let count = $$publr.state(props.initial, "count@108");
  const initial = count.read();
  const doubled = $$publr.derived(() => count.read() * 2, "doubled@171");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment: increment});
return $$html.template("<section><button data-p-on=\"click:increment\">+</button><output><!--p:html:307--><!--/p:html:307--> / <!--p:html:317--><!--/p:html:317--> / <!--p:html:329--><!--/p:html:329--></output></section>", {}, {"increment": (_dataset, {event}) => increment(event)}, [$$html.slot(307, () => count.read()),$$html.slot(317, () => doubled.read()),$$html.slot(329, () => initial)], {});
}

$$html.register("Counter_1565eae217ef514d", Counter);
