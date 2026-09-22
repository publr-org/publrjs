import * as $$dom from "publr/dom";
import { reactive } from "../../src/publr";



export function TodoList({
  title,
  initialItems,
  children,
}



) {
  const state = reactive({
    open: true,
    items: initialItems.map((item) => ({ ...item, done: item.done ?? false })),
  });

  function toggle(id) {
    const item = state.items.find((i) => i.id === id);
    if (item) item.done = !item.done;
  }

  function remove(id) {
    const at = state.items.findIndex((i) => i.id === id);
    if (at !== -1) state.items.splice(at, 1);
  }

  return (
    $$dom.element("section", $$domElement => { $$dom.classes($$domElement, () => ["todo-list", { "is-open": state.open, "is-empty": state.items.length === 0 }]); $$dom.append($$domElement, $$dom.element("header", $$domElement => { $$dom.append($$domElement, $$dom.element("h2", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => title)); $$dom.append($$domElement, $$dom.literal(" · ")); $$dom.append($$domElement, $$dom.insert(() => state.items.filter((item) => !item.done).length)); $$dom.append($$domElement, $$dom.literal(" remaining")); })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "toggle-open"); $$dom.attribute($$domElement, "type", "button"); $$dom.event($$domElement, "click", (() => {
	            state.open = !state.open;
	          })); $$dom.append($$domElement, $$dom.insert(() => state.open ? "Hide" : "Show")); })); })); $$dom.append($$domElement, $$dom.when(() => state.open, () => $$dom.element("div", $$domElement => { $$dom.classes($$domElement, () => "body"); $$dom.append($$domElement, $$dom.show($$dom.element("p", $$domElement => { $$dom.classes($$domElement, () => "empty"); $$dom.append($$domElement, $$dom.literal("Nothing left.")); }), () => state.items.length === 0)); $$dom.append($$domElement, $$dom.show($$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$dom.list(() => state.items, ($$p, $i) => $$p.id, ($$p, $i) => $$dom.element("li", $$domElement => { $$dom.classes($$domElement, () => ["todo", { "is-done": $$p().done }]); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "t"); $$dom.attribute($$domElement, "type", "button"); $$dom.event($$domElement, "click", (() => toggle($$p().id))); $$dom.append($$domElement, $$dom.insert(() => $$p().done ? "Reopen" : "Complete")); $$dom.append($$domElement, $$dom.literal(": ")); $$dom.append($$domElement, $$dom.insert(() => $$p().text)); })); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.classes($$domElement, () => "r"); $$dom.attribute($$domElement, "type", "button"); $$dom.event($$domElement, "click", (() => remove($$p().id))); $$dom.attr($$domElement, "aria-label", () => `Remove ${$$p().text}`); $$dom.append($$domElement, $$dom.literal("Remove")); })); }))); }), () => state.items.length > 0)); $$dom.append($$domElement, $$dom.when(() => children != null, () => $$dom.element("footer", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => children)); }))); }))); })
  );
}
