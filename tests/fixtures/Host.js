import * as $$dom from "publr/dom";
import { TodoList } from "./TodoList.js";
import { data } from "./state";

export function Host() {
  return (
    $$dom.component(TodoList, {
	title: "Launch",
	get initialItems() {
		return data;
	},
	get children() {
		return $$dom.element("small", $$domElement => { $$dom.append($$domElement, $$dom.literal("auto-saved")); });
	}
})
  );
}
