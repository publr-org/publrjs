import * as $$dom from "publr/dom";
const $$domFamily = $$dom.family("Parts", () => {
  const state = Publr.reactive({
  items: [{ id: 1 }],
  picks: 0,
});
  const prefix = "#";
  let added = 1;
  function label(id) {
  return `${prefix}${id}`;
}
  const pick = () => {
  state.picks++;
};
  const add = () => {
  added++;
  state.items = [...state.items, { id: added }];
};
  return { state, prefix, get added() { return added; }, set added($$v) { added = $$v; }, label, pick, add };
});
export const state = $$domFamily.field("state");
export const pick = $$domFamily.action("pick");
export const add = $$domFamily.action("add");
// A family module with private values, a root and two more components that
// read the store and the private helpers. Every part reaches the instance of
// the root it renders under, in a list row too, never a second one.
import {Publr} from "publr";






export const Parts = $$domFamily.root(function Parts($$p) {
  const { prefix, added, label } = $$domFamily.current();
  return (
    $$dom.element("section", $$domElement => { $$dom.attr($$domElement, "data-name", () => $$p.name); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "add"); $$dom.event($$domElement, "click", (() => add())); $$dom.append($$domElement, $$dom.literal("add")); })); $$dom.append($$domElement, $$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$dom.list(() => state.items, ($$p1, $i) => $$p1.id, ($$p1, $i) => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.component(Item, { get id() {
	return $$p1().id;
} })); }))); })); $$dom.append($$domElement, $$dom.component(Summary, {})); })
  );
});
export function Item($$p) {
  const { label } = $$domFamily.current();
  return (
    $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "item"); $$dom.event($$domElement, "click", (() => pick())); $$dom.append($$domElement, $$dom.insert(() => label($$p.id))); $$dom.append($$domElement, $$dom.literal(":")); $$dom.append($$domElement, $$dom.insert(() => state.picks)); })
  );
}
export function Summary() {
  const { prefix, added } = $$domFamily.current();
  return (
    $$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => prefix)); $$dom.append($$domElement, $$dom.insert(() => state.picks)); $$dom.append($$domElement, $$dom.literal("/")); $$dom.append($$domElement, $$dom.insert(() => added)); })
  );
}
