import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import {Loading} from "publr/dom";
import { operation as $$publrOperation } from "publr/transport";
const fetchUsers = (...args) => $$publrOperation("/_publr/22b2f5af1f2581b3/fetchUsers", args);
export function Users($$domProps0) {
  let search = $$publr.state($$domProps0.search, "search@176");
  const users = $$publr.awaited(() => fetchUsers(search.read()), { id: "users@214", inputs: () => [search.read()], key: () => ["/_publr/22b2f5af1f2581b3/fetchUsers", (() => [search.read()])()] });
  return $$dom.element("section", $$domElement => { $$dom.attr($$domElement, "aria-busy", () => $$publr.isPending(users)); $$dom.append($$domElement, $$dom.element("input", $$domElement => { $$dom.attr($$domElement, "value", () => search.read()); $$dom.event($$domElement, "input", ((event) => search.write(event.currentTarget.value))); })); $$dom.append($$domElement, $$dom.component(Loading, {
	get fallback() {
		return $$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.literal("Loading users…")); });
	},
	get children() {
		return $$dom.element("ul", $$domElement => { $$dom.append($$domElement, $$dom.list(() => users.read(), ($$p1, $i) => $$p1.id, ($$p1, $i) => $$dom.element("li", $$domElement => { $$dom.append($$domElement, $$dom.element("input", $$domElement => {  })); $$dom.append($$domElement, $$dom.insert(() => $$p1().name)); }))); });
	}
})); });
}
