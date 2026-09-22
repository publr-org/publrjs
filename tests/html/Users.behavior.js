import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import {Loading} from "publr/html";
import { operation as $$publrOperation } from "publr/transport";
const fetchUsers = (...args) => $$publrOperation("/_publr/22b2f5af1f2581b3/fetchUsers", args);
export function Users(props) {
  let search = $$publr.state(props.search, "search@176");
  const users = $$publr.awaited(() => fetchUsers(search.read()), { id: "users@214", inputs: () => [search.read()], key: () => ["/_publr/22b2f5af1f2581b3/fetchUsers", (() => [search.read()])()] });
  return $$html.template("<section data-p-bind=\"aria-busy:$p260_0\"><input data-p-on=\"input:p303_1\" data-p-bind=\"value:$p303_0\"><!--p:html:388--><!--/p:html:388--></section>", {"p260_0": () => $$publr.isPending(users),"p303_0": () => search.read()}, {"p303_1": (_dataset, {event}) => ((event) => search.write(event.currentTarget.value))(event)}, [$$html.slot(388, () => $$html.Loading({get "fallback"() { return $$html.template("<p>Loading users…</p>", {}, {}, [], {}); }}, () => $$html.template("<ul><!--p:html:443--><!--/p:html:443--></ul>", {}, {}, [$$html.slot(443, () => $$html.map(() => users.read(), (user) => user.id, (user) => $$html.template("<li><input><!--p:html:491--><!--/p:html:491--></li>", {"__key": () => user().id}, {}, [$$html.slot(491, () => user().name)], {})))], {})))], {});
}

$$html.register("Users_faf761d4bebc0585", Users);
