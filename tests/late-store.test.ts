// A `data-p-store` root met before its local store is registered: the runtime's
// load-time pass must leave it alone (subtree included) and wire it the moment
// `createLocalStore` names it. That is the order on a page that links `publr.js`
// and its stores module as separate async scripts.

import { beforeEach, describe, expect, it } from "vitest";
import { loadRuntime, tick, html, $, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

const markup = `<div id="root" data-p-store="late" data-p-bind="aria-busy:$busy" aria-busy="true">
  <button id="go" data-p-on="click:toggle">go</button>
  <span id="mark" data-p-show="$open" hidden>open</span>
</div>`;

describe("a root whose local store arrives later", () => {
  it("is left unwired, then hydrated when the store is registered", async () => {
    html(markup);
    Publr.hydrate(document);
    await tick();

    // Nothing wired: the click does nothing and the bind has not run.
    $("#go").click();
    await tick();
    expect($("#mark").hidden).toBe(true);
    expect($("#root").getAttribute("aria-busy")).toBe("true");

    Publr.createLocalStore("late", () => {
      const state = Publr.reactive({ open: false, busy: false });
      return { state, actions: { toggle: () => (state.open = !state.open) } };
    });
    await tick();

    expect($("#root").getAttribute("aria-busy")).toBe("false");
    $("#go").click();
    await tick();
    expect($("#mark").hidden).toBe(false);
  });

  it("does not stack a second wiring when the store was there all along", async () => {
    Publr.createLocalStore("early", () => {
      const state = Publr.reactive({ open: false, count: 0 });
      return {
        state,
        actions: {
          toggle: () => {
            state.open = !state.open;
            state.count += 1;
          },
        },
      };
    });
    html(`<div data-p-store="early"><button id="b" data-p-on="click:toggle">b</button>
      <i id="n" data-p-text="$count"></i></div>`);
    Publr.hydrate(document);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    await tick();
    expect($("#n").textContent).toBe("1");
  });
});
