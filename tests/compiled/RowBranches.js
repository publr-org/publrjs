import * as $$dom from "publr/dom";
const $$domFamily = $$dom.family("RowBranches", () => {
  const state = Publr.reactive({
  rows: [
    { id: 1, on: false },
    { id: 2, on: true },
  ],
});
  const flip = (id) => {
  const row = state.rows.find((candidate) => candidate.id === id);
  if (row) row.on = !row.on;
};
  const replace = () => {
  state.rows = state.rows.map((row) => ({ ...row, on: !row.on }));
};
  const swap = () => {
  state.rows = [
    { id: 2, on: true },
    { id: 3, on: false },
  ];
};
  return { state, flip, replace, swap };
});
export const state = $$domFamily.field("state");
export const flip = $$domFamily.action("flip");
export const replace = $$domFamily.action("replace");
export const swap = $$domFamily.action("swap");
// A store list whose rows are conditionals: `cond && <X/>` as the row and a
// ternary between two components as the row, beside branches inside a row.
// Toggling a row and replacing the list must settle, never loop.
import {Publr} from "publr";




function Text($$p) { const $$p$j_children = $$p.children;
  return $$dom.element("em", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => typeof $$p$j_children === "string" || typeof $$p$j_children === "number" ? $$p.children : $$p$j_children)); });
}
export const RowBranches = $$domFamily.root(function RowBranches() {
  return (
    $$dom.element("div", $$domElement => { $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "replace"); $$dom.event($$domElement, "click", (() => replace())); $$dom.append($$domElement, $$dom.literal("replace")); })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "swap"); $$dom.event($$domElement, "click", (() => swap())); $$dom.append($$domElement, $$dom.literal("swap")); })); $$dom.append($$domElement, $$dom.element("nav", $$domElement => { $$dom.append($$domElement, $$dom.list(() => state.rows, ($$p, $i) => $$p.id, ($$p, $i) => $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", (() => flip($$p().id))); $$dom.append($$domElement, $$dom.insert(() => $$p().id)); }))); })); $$dom.append($$domElement, $$dom.element("p", $$domElement => { $$dom.classes($$domElement, () => "guard"); $$dom.append($$domElement, $$dom.list(() => state.rows, ($$p, $i) => $$p.id, ($$p, $i) => $$dom.when(() => $$p().on, () => $$dom.element("span", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => $$p().id)); })))); })); $$dom.append($$domElement, $$dom.element("p", $$domElement => { $$dom.classes($$domElement, () => "ternary"); $$dom.append($$domElement, $$dom.list(() => state.rows, ($$p, $i) => $i, ($$p, $i) => $$dom.when(() => $$p().on, () => $$dom.component(Text, { get children() {
	return "on";
} }), () => $$dom.component(Text, { get children() {
	return "off";
} })))); })); $$dom.append($$domElement, $$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$dom.list(() => state.rows, ($$p, $i) => $$p.id, ($$p, $i) => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.when(() => $$p().on, () => $$dom.element("span", $$domElement => { $$dom.append($$domElement, $$dom.literal("x")); }))); $$dom.append($$domElement, $$dom.when(() => $$p().on, () => $$dom.component(Text, { get children() {
	return "on";
} }), () => $$dom.component(Text, { get children() {
	return "off";
} }))); }))); })); })
  );
});
