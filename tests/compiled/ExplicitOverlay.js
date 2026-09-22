import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import {ref} from "publr/runtime";

export function ExplicitOverlay() {
  const trigger = ref();
  const target = ref();
  let count = $$publr.state(0, "count@163");
  let offset = $$publr.state(8, "offset@187");

  function increment() { count.update($$value => { const $$result = $$value++; return [$$value, $$result]; }); offset.write(16); }

  $$publr.captureActions({increment});
return (
    $$dom.element("section", $$domElement => { $$dom.classes($$domElement, () => "explicit-overlay"); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.attribute($$domElement, "data-p-anchor", true); $$dom.append($$domElement, $$dom.literal("Decoy")); })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.reference($$domElement, trigger); $$dom.append($$domElement, $$dom.literal("Anchor")); })); $$dom.append($$domElement, $$dom.element("aside", $$domElement => { $$dom.classes($$domElement, () => "custom"); $$dom.attr($$domElement, "data-p-portal", () => target); $$dom.attr($$domElement, "data-p-position", () => ({ anchor: trigger, placement: "right-start", offset: offset.read(), flip: false, shift: false })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", increment); $$dom.append($$domElement, $$dom.insert(() => count.read())); })); $$dom.enhance($$domElement, ["portal","position"]); })); $$dom.append($$domElement, $$dom.element("aside", $$domElement => { $$dom.classes($$domElement, () => "selector"); $$dom.attribute($$domElement, "data-p-portal", "#custom-portal"); $$dom.append($$domElement, $$dom.literal("Selector")); $$dom.enhance($$domElement, ["portal"]); })); $$dom.append($$domElement, $$dom.element("aside", $$domElement => { $$dom.classes($$domElement, () => "inline"); $$dom.attr($$domElement, "data-p-position", () => ({ anchor: trigger, placement: "top-end", offset: 5 })); $$dom.append($$domElement, $$dom.literal("Inline")); $$dom.enhance($$domElement, ["position"]); })); $$dom.append($$domElement, $$dom.element("div", $$domElement => { $$dom.attribute($$domElement, "id", "custom-portal"); $$dom.reference($$domElement, target); })); })
  );
}
