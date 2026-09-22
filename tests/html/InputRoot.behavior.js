import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";

export function InputRoot(props) {
  let value = $$publr.state(props.initial, "value@93");
  return $$html.template("<input data-p-on=\"input:p132_1\" data-p-bind=\"value:$p132_0\">", {"p132_0": () => value.read()}, {"p132_1": (_dataset, {event}) => (event => value.write(event.currentTarget.value))(event)}, [], {});
}

$$html.register("InputRoot_7d034695941a9560", InputRoot);
