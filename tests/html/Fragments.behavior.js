import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";

export function Fragments() {
  let count = $$publr.state(0, "count@67");
  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); }
  $$publr.captureActions({increment: increment});
return $$html.template("<button data-p-on=\"click:increment\">+</button><output data-p-text=\"$v180\"></output>", {"v180": () => count.read()}, {"increment": (_dataset, {event}) => increment(event)}, [], {});
}

$$html.register("Fragments_51d125c3eca64154", Fragments);
