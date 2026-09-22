import * as $$html from "publr/html";
import * as $$publr from "publr/runtime";
export function Hello() {
  function greet() {
    alert("Hello from Publr");
  }

  return $$html.template("<button data-p-on=\"click:greet\">Hello</button>", {}, {"greet": (_dataset, {event}) => greet(event)}, [], {});
}

$$html.register("Hello_ae2b76e3152546f4", Hello);
