// Compiled expressions: a binding names a slot, the function runs in the
// binding's scope (its arguments, imported state, then the `$` path chain) and
// re-runs when what it read changes.

import { beforeEach, describe, expect, it } from "vitest";
import { loadRuntime, tick, html, $, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("compiled expressions", () => {
  it("run in the instance's own store, beside its actions", async () => {
    Publr.createLocalStore("row", () => {
      const state = rt.reactive({ editing: false, empty: true });
      return {
        state,
        actions: {},
        expressions: { e_Row_1: () => !state.editing && state.empty },
      };
    });
    html(
      '<div data-p-store="row"><button data-p-bind="disabled:$e_Row_1"></button></div>' +
        '<div data-p-store="row"><button data-p-bind="disabled:$e_Row_1"></button></div>',
    );
    Publr.hydrate(document);
    await tick();
    const [first, second] = document.querySelectorAll("div");
    const button = (root: Element) => root.querySelector("button")!;
    expect(button(first).disabled).toBe(true);
    (first as any)._ps[0].editing = true;
    await tick();
    expect(button(first).disabled).toBe(false);
    expect(button(second).disabled).toBe(true);
  });

  it("take props as arguments: the caller's wire or a JSON value", async () => {
    const state = rt.reactive({ rows: [{ tone: "success" }] });
    Publr.createLocalStore("list", () => ({ state, actions: {} }));
    const TONES: Record<string, string> = { success: "text-success" };
    Publr.expressions(
      {},
      {
        e_Badge_1: ({ tone, size }: any) => `${TONES[tone] ?? "text-muted"} ${size}`,
      },
    );
    html(
      '<ul data-p-store="list"><template data-p-for="row of $rows">' +
        '<li data-p-class="$e_Badge_1(tone: $row.tone, size: &quot;text-sm&quot;)"></li>' +
        "</template></ul>",
    );
    Publr.hydrate(document);
    await tick();
    expect($("li").className).toBe("text-success text-sm");
    state.rows[0].tone = "draft";
    await tick();
    expect($("li").className).toBe("text-muted text-sm");
  });

  it("read imported state from the store it names", async () => {
    Publr.createLocalStore("dialog", () => ({ state: rt.reactive({ open: false }), actions: {} }));
    Publr.expressions({ state: "dialog" }, { e_DialogTrigger_1: ({ state }: any) => state.open });
    html(
      '<div data-p-store="dialog"><button data-p-bind="aria-expanded:$e_DialogTrigger_1"></button></div>',
    );
    Publr.hydrate(document);
    await tick();
    expect($("button").getAttribute("aria-expanded")).toBe("false");
    ($("div") as any)._ps[0].open = true;
    await tick();
    expect($("button").getAttribute("aria-expanded")).toBe("true");
  });

  it("drive text, show, if and a list's source", async () => {
    Publr.createLocalStore("cart", () => {
      const state = rt.reactive({ items: [{ id: 1, price: 2 }], open: true });
      return {
        state,
        actions: {},
        expressions: {
          e_Cart_1: () => state.items.reduce((sum, item) => sum + item.price, 0),
          e_Cart_2: () => state.items.length > 1 && state.open,
          e_Cart_3: () => state.items.filter((item) => item.price > 1),
        },
      };
    });
    html(
      '<div data-p-store="cart"><p data-p-text="$e_Cart_1"></p><span data-p-show="$e_Cart_2"></span>' +
        '<template data-p-if="$e_Cart_2"><em>many</em></template>' +
        '<ol><template data-p-for="item of $e_Cart_3" data-p-key="$item.id"><li data-p-text="$item.price"></li></template></ol></div>',
    );
    Publr.hydrate(document);
    await tick();
    expect($("p").textContent).toBe("2");
    expect($("span").hidden).toBe(true);
    expect(document.querySelector("em")).toBeNull();
    expect(document.querySelectorAll("li").length).toBe(1);
    const state = ($("div") as any)._ps[0];
    state.items.push({ id: 2, price: 5 });
    await tick();
    expect($("p").textContent).toBe("7");
    expect($("span").hidden).toBe(false);
    expect(document.querySelector("em")).not.toBeNull();
    expect(document.querySelectorAll("li").length).toBe(2);
  });

  it("swap the class list they computed last, the server's first", async () => {
    Publr.createLocalStore("drop", () => {
      const state = rt.reactive({ dropping: false });
      return {
        state,
        actions: {},
        expressions: {
          e_Drop_1: () => (state.dropping ? "border-primary bg-primary/5" : "border-border"),
        },
      };
    });
    html('<div data-p-store="drop" class="p-3 border-border" data-p-class="$e_Drop_1"></div>');
    Publr.hydrate(document);
    await tick();
    const state = ($("div") as any)._ps[0];
    state.dropping = true;
    await tick();
    expect($("div").className).toBe("p-3 border-primary bg-primary/5");
    state.dropping = false;
    await tick();
    expect($("div").className).toBe("p-3 border-border");
  });
});

describe("compiled expressions and the element", () => {
  it("read the evaluating element's data through Publr.dataset", async () => {
    const rt = await loadRuntime();
    const Publr = rt.Publr;
    Publr.createLocalStore("picker", () => {
      const state = rt.reactive({ values: ["b"] });
      return {
        state,
        actions: {},
        expressions: { e_Picker_1: () => state.values.includes(Publr.dataset("value")!) },
      };
    });
    html(
      '<div data-p-store="picker"><button data-value="a" data-p-bind="aria-pressed:$e_Picker_1"></button>' +
        '<button data-value="b" data-p-bind="aria-pressed:$e_Picker_1"></button></div>',
    );
    Publr.hydrate(document);
    await tick();
    const [a, b] = document.querySelectorAll("button");
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  it("read an absent optional prop as undefined", async () => {
    const rt = await loadRuntime();
    rt.Publr.expressions(
      {},
      { e_Item_1: ({ href }: any) => (href === undefined ? "button" : "link") },
    );
    html('<a data-p-bind="data-kind:$e_Item_1(href: undefined)"></a>');
    rt.Publr.hydrate(document);
    await tick();
    expect($("a").getAttribute("data-kind")).toBe("button");
  });
});
