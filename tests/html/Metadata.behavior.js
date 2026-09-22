import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
import {Loading} from "publr/html";
import { operation as $$publrOperation } from "publr/transport";
const profile = (...args) => $$publrOperation("/_publr/7a733e59ccb8dd63/profile", args);
const scalar = (...args) => $$publrOperation("/_publr/50dc0a416f1a2900/scalar", args);

export function Metadata() {
  const data = $$publr.awaited(() => profile(), { id: "data@176", inputs: () => [], cache: () => ({ cache: { ttl: 60000, tags: ["profiles"] } }).cache, key: () => ["/_publr/7a733e59ccb8dd63/profile", (() => [])()] });
  const number = $$publr.awaited(() => scalar(), { id: "number@258", inputs: () => [], key: () => ["/_publr/50dc0a416f1a2900/scalar", (() => [])()] });
  const linked = $$publr.derived(() => data.read(), "linked@294");

  function reload() {
    $$publr.refresh(data);
  }

  $$publr.captureActions({reload: reload});
return (
    $$html.template("<section data-p-bind=\"aria-busy:$p386_0;data-error:$p386_1\"><button data-p-on=\"click:reload\">Refresh</button><!--p:html:506--><!--/p:html:506--><b data-p-bind=\"aria-busy:$p724_0;data-error:$p724_1\">Metadata</b></section>", {"p386_0": () => data.pending(),"p386_1": () => data.isError(),"p724_0": () => linked.pending(),"p724_1": () => linked.isError()}, {"reload": (_dataset, {event}) => reload(event)}, [$$html.slot(506, () => $$html.Loading({get "fallback"() { return $$html.template("<i>Loading</i>", {}, {}, [], {}); }}, () => $$html.template("<p><!--p:html:553--><!--/p:html:553--> / <!--p:html:577--><!--/p:html:577--> / <!--p:html:605--><!--/p:html:605--></p><span data-p-text=\"$v647\"></span>", {"v647": () => $$publr.valueOf(number) === null ? "null" : "number"}, {}, [$$html.slot(553, () => $$publr.valueOf(data).error),$$html.slot(577, () => $$publr.valueOf(data).isPending),$$html.slot(605, () => $$publr.valueOf(data).isError)], {})))], {})
  );
}

$$html.register("Metadata_be66011bee42ea22", Metadata);
