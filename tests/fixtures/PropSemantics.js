import * as $$dom from "publr/dom";
let defaultCalls = 0;

function defaultValue() {
  defaultCalls += 1;
  return 1.25;
}

export function resetDefaultCalls() {
  defaultCalls = 0;
}

export function getDefaultCalls() {
  return defaultCalls;
}










export function PropSemantics({
  value = defaultValue(),
  enabled,
  label,
  count,
  live = { label: "Live" },
  items = [],
}) {
  return (
    $$dom.element("section", $$domElement => { $$dom.append($$domElement, $$dom.element("output", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => value)); })); $$dom.append($$domElement, $$dom.element("span", $$domElement => { $$dom.attribute($$domElement, "data-live", true); $$dom.append($$domElement, $$dom.insert(() => live.label)); })); $$dom.append($$domElement, $$dom.when(() => enabled === true, () => $$dom.element("b", $$domElement => { $$dom.attribute($$domElement, "data-enabled", true); $$dom.append($$domElement, $$dom.literal("Enabled")); }))); $$dom.append($$domElement, $$dom.when(() => label != null, () => $$dom.element("b", $$domElement => { $$dom.attribute($$domElement, "data-label", true); $$dom.append($$domElement, $$dom.insert(() => label)); }))); $$dom.append($$domElement, $$dom.when(() => count != null, () => $$dom.element("b", $$domElement => { $$dom.attribute($$domElement, "data-count", true); $$dom.append($$domElement, $$dom.insert(() => count)); }))); $$dom.append($$domElement, $$dom.list(() => items, ($$p, $i) => $i, ($$p, $i) => $$dom.element("div", $$domElement => { $$dom.attribute($$domElement, "data-row", true); $$dom.append($$domElement, $$dom.when(() => $$p().label != null, () => $$dom.element("i", $$domElement => { $$dom.attribute($$domElement, "data-row-label", true); $$dom.append($$domElement, $$dom.insert(() => $$p().label)); }))); $$dom.append($$domElement, $$dom.when(() => $$p().enabled === true, () => $$dom.element("i", $$domElement => { $$dom.attribute($$domElement, "data-row-enabled", true); $$dom.append($$domElement, $$dom.literal("Enabled")); }))); $$dom.append($$domElement, $$dom.when(() => label != null, () => $$dom.element("i", $$domElement => { $$dom.attribute($$domElement, "data-outer-label", true); $$dom.append($$domElement, $$dom.insert(() => label)); }))); }))); })
  );
}
