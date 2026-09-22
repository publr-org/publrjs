import * as $$dom from "publr/dom";
import * as $$publr from "publr/runtime";
import {Loading} from "publr/dom";
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

  $$publr.captureActions({reload});
return (
    $$dom.element("section", $$domElement => { $$dom.attr($$domElement, "aria-busy", () => data.pending()); $$dom.attr($$domElement, "data-error", () => data.isError()); $$dom.append($$domElement, $$dom.element("button", $$domElement => { $$dom.event($$domElement, "click", reload); $$dom.append($$domElement, $$dom.literal("Refresh")); })); $$dom.append($$domElement, $$dom.component(Loading, {
	get fallback() {
		return $$dom.element("i", $$domElement => { $$dom.append($$domElement, $$dom.literal("Loading")); });
	},
	get children() {
		return [$$dom.element("p", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => $$publr.valueOf(data).error)); $$dom.append($$domElement, $$dom.literal(" / ")); $$dom.append($$domElement, $$dom.insert(() => $$publr.valueOf(data).isPending)); $$dom.append($$domElement, $$dom.literal(" / ")); $$dom.append($$domElement, $$dom.insert(() => $$publr.valueOf(data).isError)); }), $$dom.element("span", $$domElement => { $$dom.append($$domElement, $$dom.insert(() => $$publr.valueOf(number) === null ? "null" : "number")); })];
	}
})); $$dom.append($$domElement, $$dom.element("b", $$domElement => { $$dom.attr($$domElement, "aria-busy", () => linked.pending()); $$dom.attr($$domElement, "data-error", () => linked.isError()); $$dom.append($$domElement, $$dom.literal("Metadata")); })); })
  );
}
