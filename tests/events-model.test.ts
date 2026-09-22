// data-p-on (events, modifiers, action dispatch) and data-p-model (two-way).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRuntime, tick, html, $, fire, key, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("data-p-on", () => {
  it("wires an event to a store action", async () => {
    const entry = Publr.createStore("app", () => ({
      state: { count: 0 },
      actions: { inc: () => entry.count++ },
    }))!;
    html(`<div data-p-store="app"><button id="b" data-p-on="click:inc"></button></div>`);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    $("#b").click();
    expect(entry.count).toBe(2);
  });

  it("passes ({ ...dataset }, { el, event }) to direct actions", async () => {
    const action = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { pick: action } }));
    html(
      `<div data-p-store="app"><button id="b" data-id="42" data-kind="x" data-p-on="click:pick"></button></div>`,
    );
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    expect(action).toHaveBeenCalledTimes(1);
    const [dataset, ctx] = action.mock.calls[0];
    // The snapshot carries every data-* attribute — including the data-p-*
    // wires themselves (camelCased by DOMStringMap).
    expect(dataset).toMatchObject({ id: "42", kind: "x", pOn: "click:pick" });
    expect(ctx.el).toBe($("#b"));
    expect(ctx.event.type).toBe("click");
  });

  it("resolves nested action paths (called without args)", async () => {
    const nested = vi.fn();
    Publr.createStore("app", () => ({
      state: {},
      actions: { menu: { open: nested } },
    }));
    html(`<div data-p-store="app"><button id="b" data-p-on="click:menu.open"></button></div>`);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    expect(nested).toHaveBeenCalledTimes(1);
    expect(nested).toHaveBeenCalledWith();
  });

  it("qualified action refs bypass the nearest store", async () => {
    const cmsSave = vi.fn();
    const editorSave = vi.fn();
    Publr.createStore("cms", () => ({ state: {}, actions: { save: cmsSave } }));
    Publr.createStore("editor", () => ({
      state: {},
      actions: { save: editorSave },
    }));
    html(`
      <div data-p-store="editor">
        <button id="b" data-p-on="click:cms::save"></button>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    expect(cmsSave).toHaveBeenCalledTimes(1);
    expect(editorSave).not.toHaveBeenCalled();
  });

  it("falls back to a function stored in state", async () => {
    const fn = vi.fn();
    Publr.createStore("app", () => ({ state: { handler: fn }, actions: {} }));
    html(`<div data-p-store="app"><button id="b" data-p-on="click:handler"></button></div>`);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("supports multiple ;-separated bindings", async () => {
    const a = vi.fn();
    const b = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { a, b } }));
    html(`<div data-p-store="app"><input id="i" data-p-on="focus:a;blur:b" /></div>`);
    Publr.hydrate(document);
    await tick();

    fire($("#i"), "focus");
    fire($("#i"), "blur");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it(".prevent calls preventDefault", async () => {
    Publr.createStore("app", () => ({ state: {}, actions: { go: vi.fn() } }));
    html(`<div data-p-store="app"><a id="l" href="/x" data-p-on="click.prevent:go"></a></div>`);
    Publr.hydrate(document);
    await tick();

    const event = fire($("#l"), "click");
    expect(event.defaultPrevented).toBe(true);
  });

  it(".stop stops propagation", async () => {
    const outer = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { hit: vi.fn() } }));
    html(
      `<div data-p-store="app"><div id="parent"><button id="b" data-p-on="click.stop:hit"></button></div></div>`,
    );
    Publr.hydrate(document);
    await tick();
    $("#parent").addEventListener("click", outer);

    $("#b").click();
    expect(outer).not.toHaveBeenCalled();
  });

  it(".once fires a single time", async () => {
    const hit = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { hit } }));
    html(`<div data-p-store="app"><button id="b" data-p-on="click.once:hit"></button></div>`);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    $("#b").click();
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("key modifiers filter keyboard events (enter, esc aliases, arrows)", async () => {
    const save = vi.fn();
    const close = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { save, close } }));
    html(
      `<div data-p-store="app"><input id="i" data-p-on="keydown.enter:save;keydown.esc:close" /></div>`,
    );
    Publr.hydrate(document);
    await tick();

    key($("#i"), "keydown", "a");
    expect(save).not.toHaveBeenCalled();

    key($("#i"), "keydown", "Enter");
    expect(save).toHaveBeenCalledTimes(1);

    key($("#i"), "keydown", "Escape");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("multiple key modifiers act as OR (keydown.up.down)", async () => {
    const move = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { move } }));
    html(`<div data-p-store="app"><div id="i" data-p-on="keydown.up.down:move"></div></div>`);
    Publr.hydrate(document);
    await tick();

    key($("#i"), "keydown", "ArrowUp");
    key($("#i"), "keydown", "ArrowDown");
    key($("#i"), "keydown", "ArrowLeft");
    expect(move).toHaveBeenCalledTimes(2);
  });

  it("supports Home and End key modifiers", async () => {
    const move = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { move } }));
    html(
      `<div data-p-store="app"><div id="i" data-p-on="keydown.home.end.prevent:move"></div></div>`,
    );
    Publr.hydrate(document);
    await tick();

    const home = key($("#i"), "keydown", "Home");
    const end = key($("#i"), "keydown", "End");
    key($("#i"), "keydown", "PageDown");

    expect(home.defaultPrevented).toBe(true);
    expect(end.defaultPrevented).toBe(true);
    expect(move).toHaveBeenCalledTimes(2);
  });

  it(".window and .document attach listeners to those targets", async () => {
    const onWin = vi.fn();
    const onDoc = vi.fn();
    Publr.createStore("app", () => ({ state: {}, actions: { onWin, onDoc } }));
    html(
      `<div data-p-store="app"><div data-p-on="keydown.window.esc:onWin;click.document:onDoc"></div></div>`,
    );
    Publr.hydrate(document);
    await tick();

    key(window, "keydown", "Escape");
    expect(onWin).toHaveBeenCalledTimes(1);

    fire(document, "click");
    expect(onDoc).toHaveBeenCalledTimes(1);
  });

  it("listeners inside islands are removed on destroy", async () => {
    const hit = vi.fn();
    Publr.createLocalStore("isl", () => ({ state: {}, actions: { hit } }));
    html(`<div id="root" data-p-store="isl"><button id="b" data-p-on="click:hit"></button></div>`);
    Publr.hydrate(document);
    await tick();

    $("#b").click();
    Publr.destroy($("#root"));
    $("#b").click();
    expect(hit).toHaveBeenCalledTimes(1);
  });
});

describe("data-p-model", () => {
  async function mountModel(markup: string, state: Record<string, any>) {
    const entry = Publr.createStore("form", () => ({ state, actions: {} }))!;
    html(`<div data-p-store="form">${markup}</div>`);
    Publr.hydrate(document);
    await tick();
    return entry;
  }

  it("qualified model refs read and write the named shared store", async () => {
    const cms = Publr.createStore("cms", () => ({
      state: { title: "CMS title" },
    }))!;
    const editor = Publr.createStore("editor", () => ({
      state: { title: "Editor title" },
    }))!;
    html(`
      <div data-p-store="editor">
        <input id="i" data-p-model="cms::title" />
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    const input = $("#i") as HTMLInputElement;
    expect(input.value).toBe("CMS title");
    input.value = "Changed";
    fire(input, "input");
    await tick();

    expect(cms.title).toBe("Changed");
    expect(editor.title).toBe("Editor title");
  });

  it("text input: state -> element and element -> state on input", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="name" />`, {
      name: "ada",
    });
    const input = $("#i") as HTMLInputElement;
    expect(input.value).toBe("ada");

    input.value = "grace";
    fire(input, "input");
    expect(entry.name).toBe("grace");

    entry.name = "linus";
    await tick();
    expect(input.value).toBe("linus");
  });

  it("|lazy syncs on change instead of input", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="name|lazy" />`, { name: "" });
    const input = $("#i") as HTMLInputElement;

    input.value = "typed";
    fire(input, "input");
    expect(entry.name).toBe("");

    fire(input, "change");
    expect(entry.name).toBe("typed");
  });

  it("|trim trims written strings", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="name|trim" />`, { name: "" });
    const input = $("#i") as HTMLInputElement;
    input.value = "  padded  ";
    fire(input, "input");
    expect(entry.name).toBe("padded");
  });

  it("$ sigil combines with stacked modifiers: $draft|lazy|trim", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="$draft|lazy|trim" />`, {
      draft: "",
    });
    const input = $("#i") as HTMLInputElement;

    input.value = "  typed  ";
    fire(input, "input");
    expect(entry.draft).toBe("");

    fire(input, "change");
    expect(entry.draft).toBe("typed");
  });

  it("|number converts numeric strings and leaves non-numeric alone", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="qty|number" />`, { qty: 0 });
    const input = $("#i") as HTMLInputElement;

    input.value = "42";
    fire(input, "input");
    expect(entry.qty).toBe(42);

    input.value = "abc";
    fire(input, "input");
    expect(entry.qty).toBe("abc");
  });

  it("checkbox: boolean both ways on change", async () => {
    const entry = await mountModel(`<input id="c" type="checkbox" data-p-model="agree" />`, {
      agree: true,
    });
    const box = $("#c") as HTMLInputElement;
    expect(box.checked).toBe(true);

    box.checked = false;
    fire(box, "change");
    expect(entry.agree).toBe(false);
  });

  it("radio group: value follows the checked radio", async () => {
    const entry = await mountModel(
      `<input type="radio" name="size" value="s" data-p-model="size" />
       <input type="radio" name="size" value="m" data-p-model="size" />`,
      { size: "m" },
    );
    const [small, medium] = [...document.querySelectorAll("input")] as HTMLInputElement[];
    expect(medium.checked).toBe(true);
    expect(small.checked).toBe(false);

    small.checked = true;
    fire(small, "change");
    expect(entry.size).toBe("s");

    // an unchecked radio's change never writes undefined into state
    medium.checked = false;
    fire(medium, "change");
    expect(entry.size).toBe("s");
  });

  it("select: value both ways on change", async () => {
    const entry = await mountModel(
      `<select id="s" data-p-model="pick">
         <option value="a">A</option><option value="b">B</option>
       </select>`,
      { pick: "b" },
    );
    const select = $("#s") as HTMLSelectElement;
    expect(select.value).toBe("b");

    select.value = "a";
    fire(select, "change");
    expect(entry.pick).toBe("a");
  });

  it("multi-select: array of selected values both ways", async () => {
    const entry = await mountModel(
      `<select id="s" multiple data-p-model="picks">
         <option value="a">A</option><option value="b">B</option><option value="c">C</option>
       </select>`,
      { picks: ["a", "c"] },
    );
    const select = $("#s") as HTMLSelectElement;
    const selected = () => [...select.options].filter((o) => o.selected).map((o) => o.value);
    expect(selected()).toEqual(["a", "c"]);

    select.options[0].selected = false;
    select.options[1].selected = true;
    fire(select, "change");
    expect(entry.picks).toEqual(["b", "c"]);
  });

  it("contenteditable: textContent both ways", async () => {
    const entry = await mountModel(`<div id="e" contenteditable data-p-model="note"></div>`, {
      note: "draft",
    });
    const el = $("#e");
    expect(el.textContent).toBe("draft");

    el.textContent = "edited";
    fire(el, "input");
    expect(entry.note).toBe("edited");
  });

  it("writes through nested paths", async () => {
    const entry = await mountModel(`<input id="i" data-p-model="user.name" />`, {
      user: { name: "ada" },
    });
    const input = $("#i") as HTMLInputElement;
    expect(input.value).toBe("ada");

    input.value = "grace";
    fire(input, "input");
    expect(entry.user.name).toBe("grace");
  });

  it("renders null state as empty string", async () => {
    await mountModel(`<input id="i" data-p-model="name" />`, { name: null });
    expect(($("#i") as HTMLInputElement).value).toBe("");
  });
});
