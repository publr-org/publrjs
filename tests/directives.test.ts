// Rendering directives: data-p-text, -show, -class, -bind, -style — the v2
// grammar: spaced predicates, flat `->`/`~` groups, match blocks with `=>`
// templates, interpolation holes, and quoted literal payloads.

import { beforeEach, describe, expect, it } from "vitest";
import { loadRuntime, tick, html, $, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

async function mount(markup: string, state: Record<string, any>) {
  const entry = Publr.createStore("app", () => ({ state, actions: {} }))!;
  html(`<div data-p-store="app">${markup}</div>`);
  Publr.hydrate(document);
  await tick();
  return entry;
}

describe("data-p-text", () => {
  it("owns static and reactive focus scopes, including controls arriving after mount", async () => {
    const state = rt.reactive({ active: true });
    Publr.createLocalStore("panel", () => ({ state }));
    html(
      '<section data-p-store="panel" data-p-focus data-p-bind="focusScope:$active" tabindex="-1"></section>',
    );
    const panel = $("section");
    Publr.hydrate(panel);
    panel.innerHTML = "<button>First</button><button>Last</button>";
    const first = panel.firstElementChild as HTMLButtonElement;
    const last = panel.lastElementChild as HTMLButtonElement;
    first.getClientRects = last.getClientRects = () =>
      [{ width: 10, height: 10 }] as unknown as DOMRectList;
    const tab = (shiftKey = false) => {
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      panel.dispatchEvent(event);
      return event.defaultPrevented;
    };
    last.focus();
    expect(tab()).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(tab(true)).toBe(true);
    expect(document.activeElement).toBe(last);
    state.active = false;
    await tick();
    expect(tab()).toBe(false);
    state.active = true;
    await tick();
    Publr.destroy(panel);
    expect(tab()).toBe(false);
  });

  it("renders a state ref and updates reactively", async () => {
    const entry = await mount(`<span id="t" data-p-text="$msg"></span>`, {
      msg: "hi",
    });
    expect($("#t").textContent).toBe("hi");

    entry.msg = "bye";
    await tick();
    expect($("#t").textContent).toBe("bye");
  });

  it("supports the $ sigil and bare refs", async () => {
    await mount(`<span id="a" data-p-text="$msg"></span><span id="b" data-p-text="msg"></span>`, {
      msg: "hi",
    });
    expect($("#a").textContent).toBe("hi");
    expect($("#b").textContent).toBe("hi");
  });

  it("renders nested paths", async () => {
    await mount(`<span id="t" data-p-text="user.name"></span>`, {
      user: { name: "ada" },
    });
    expect($("#t").textContent).toBe("ada");
  });

  it("renders empty string for null/undefined values", async () => {
    await mount(`<span id="t" data-p-text="missing"></span>`, { other: 1 });
    expect($("#t").textContent).toBe("");
  });

  it("flat form: $cond -> 'on' ~ 'off'", async () => {
    const entry = await mount(`<span id="t" data-p-text="$active -> 'on' ~ 'off'"></span>`, {
      active: false,
    });
    expect($("#t").textContent).toBe("off");

    entry.active = true;
    await tick();
    expect($("#t").textContent).toBe("on");
  });

  it("flat form else-branch defaults to empty string", async () => {
    await mount(`<span id="t" data-p-text="$active -> 'on'"></span>`, {
      active: false,
    });
    expect($("#t").textContent).toBe("");
  });

  it("flat form accepts predicates and negation", async () => {
    const entry = await mount(
      `<span id="t" data-p-text="$count > 2 -> 'many' ~ 'few'"></span>
       <span id="n" data-p-text="not $active -> 'closed' ~ 'open'"></span>`,
      { count: 1, active: false },
    );
    expect($("#t").textContent).toBe("few");
    expect($("#n").textContent).toBe("closed");

    entry.count = 5;
    entry.active = true;
    await tick();
    expect($("#t").textContent).toBe("many");
    expect($("#n").textContent).toBe("open");
  });

  it("fallback form: $value ~ 'fallback' when null or empty", async () => {
    const entry = await mount(`<span id="t" data-p-text="$name ~ 'anonymous'"></span>`, {
      name: "",
    });
    expect($("#t").textContent).toBe("anonymous");

    entry.name = "ada";
    await tick();
    expect($("#t").textContent).toBe("ada");
  });

  it("keeps delimiters inside quoted literals intact", async () => {
    await mount(`<span id="t" data-p-text="$on -> 'a -> b ~ c' ~ 'x'"></span>`, { on: true });
    expect($("#t").textContent).toBe("a -> b ~ c");
  });

  it("match form selects the arm by String(value) with _ default", async () => {
    const entry = await mount(
      `<span id="t" data-p-text="$status { open: 'Expanded', _: 'Collapsed' }"></span>`,
      { status: "open" },
    );
    expect($("#t").textContent).toBe("Expanded");

    entry.status = "closed";
    await tick();
    expect($("#t").textContent).toBe("Collapsed");
  });

  it("match form: no matching arm and no _ writes the empty string", async () => {
    await mount(`<span id="t" data-p-text="$status { open: 'Expanded' }"></span>`, {
      status: "closed",
    });
    expect($("#t").textContent).toBe("");
  });

  it("match form composes with predicate discriminants and true/false arms", async () => {
    const entry = await mount(
      `<span id="t" data-p-text="$count > 5 { true: 'many', false: 'few' }"></span>`,
      { count: 2 },
    );
    expect($("#t").textContent).toBe("few");

    entry.count = 9;
    await tick();
    expect($("#t").textContent).toBe("many");
  });
});

describe("data-p-show", () => {
  it("toggles the hidden class from a truthy ref", async () => {
    const entry = await mount(`<div id="s" data-p-show="visible"></div>`, {
      visible: false,
    });
    expect($("#s").classList.contains("hidden")).toBe(true);

    entry.visible = true;
    await tick();
    expect($("#s").classList.contains("hidden")).toBe(false);
  });

  it("adopts an SSR hidden attribute and then owns visibility", async () => {
    const entry = await mount(`<div id="s" hidden data-p-show="$visible"></div>`, {
      visible: false,
    });
    expect($("#s").hasAttribute("hidden")).toBe(false);
    expect($("#s").classList.contains("hidden")).toBe(true);

    entry.visible = true;
    await tick();
    expect($("#s").hasAttribute("hidden")).toBe(false);
    expect($("#s").classList.contains("hidden")).toBe(false);
  });

  it("supports not negation", async () => {
    await mount(`<div id="s" data-p-show="not $busy"></div>`, { busy: false });
    expect($("#s").classList.contains("hidden")).toBe(false);
  });

  it.each([
    ["$count == 3", 3, true],
    ["$count == 3", 4, false],
    ["$count != 3", 4, true],
    ["$count < 5", 4, true],
    ["$count > 5", 6, true],
    ["$count >= 5", 5, true],
    ["$count <= 5", 5, true],
    ["$count > 5", 5, false],
  ])("predicate %s with count=%d shows=%s", async (spec, count, shown) => {
    await mount(`<div id="s" data-p-show="${spec}"></div>`, { count });
    expect($("#s").classList.contains("hidden")).toBe(!shown);
  });

  it("negated predicates: not $count > 5", async () => {
    await mount(`<div id="s" data-p-show="not $count > 5"></div>`, {
      count: 9,
    });
    expect($("#s").classList.contains("hidden")).toBe(true);
  });

  it("compares against quoted literals containing spaces", async () => {
    await mount(`<div id="s" data-p-show="$title == 'Hello world'"></div>`, {
      title: "Hello world",
    });
    expect($("#s").classList.contains("hidden")).toBe(false);
  });

  it.each([
    ["string", "hello", true],
    ["string", "nope", false],
    ["array", ["a", "ell", "b"], true],
    ["array", ["a", "b"], false],
    ["null", null, false],
    ["number", 7, false],
  ])("contains is duck-typed over %s values (%j -> %s)", async (_kind, value, shown) => {
    await mount(`<div id="s" data-p-show="$v contains 'ell'"></div>`, {
      v: value,
    });
    expect($("#s").classList.contains("hidden")).toBe(!shown);
  });

  it("compares state with the nearest authored data value", async () => {
    const state = await mount(
      `<section data-value="details">
        <button id="trigger" data-p-bind="aria-expanded:$open contains @value"></button>
        <div id="option" data-value="banana" data-p-bind="aria-selected:$selected == @value"></div>
      </section>`,
      { selected: "banana", open: ["details"] },
    );

    expect($("#trigger").getAttribute("aria-expanded")).toBe("true");
    expect($("#option").getAttribute("aria-selected")).toBe("true");
    state.selected = "apple";
    state.open = [];
    await tick();
    expect($("#trigger").getAttribute("aria-expanded")).toBe("false");
    expect($("#option").getAttribute("aria-selected")).toBe("false");
  });
});

describe("data-p-class", () => {
  it("toggles a whitespace-joined class list with the ref", async () => {
    const entry = await mount(`<div id="c" data-p-class="$open -> block shadow"></div>`, {
      open: false,
    });
    expect($("#c").classList.contains("block")).toBe(false);

    entry.open = true;
    await tick();
    expect($("#c").classList.contains("block")).toBe(true);
    expect($("#c").classList.contains("shadow")).toBe(true);
  });

  it("swaps IF/ELSE branches so paired utilities never stack", async () => {
    const entry = await mount(`<div id="c" data-p-class="$open -> block ~ hidden"></div>`, {
      open: false,
    });
    expect($("#c").classList.contains("hidden")).toBe(true);
    expect($("#c").classList.contains("block")).toBe(false);

    entry.open = true;
    await tick();
    expect($("#c").classList.contains("block")).toBe(true);
    expect($("#c").classList.contains("hidden")).toBe(false);
  });

  it("keeps bracketed arbitrary values whole (internal commas, ; and ~)", async () => {
    await mount(
      `<div id="c" data-p-class="$on -> w-[calc(100%+1rem)] grid-cols-[repeat(2,minmax(0,1fr))]"></div>`,
      { on: true },
    );
    expect($("#c").classList.contains("w-[calc(100%+1rem)]")).toBe(true);
    expect($("#c").classList.contains("grid-cols-[repeat(2,minmax(0,1fr))]")).toBe(true);
  });

  it("supports multiple ;-separated groups, predicates, and negation", async () => {
    const entry = await mount(
      `<div id="c" data-p-class="$count > 0 -> has-items; not $busy -> idle"></div>`,
      { count: 0, busy: false },
    );
    expect($("#c").classList.contains("has-items")).toBe(false);
    expect($("#c").classList.contains("idle")).toBe(true);

    entry.count = 2;
    entry.busy = true;
    await tick();
    expect($("#c").classList.contains("has-items")).toBe(true);
    expect($("#c").classList.contains("idle")).toBe(false);
  });

  it("match form swaps arm class lists atomically (server classes included)", async () => {
    const entry = await mount(
      `<div id="c" class="bg-muted" data-p-class="$env { Production: bg-success text-white, _: bg-muted }"></div>`,
      { env: "Production" },
    );
    // The server rendered the _ arm; the client state says Production.
    expect($("#c").classList.contains("bg-success")).toBe(true);
    expect($("#c").classList.contains("text-white")).toBe(true);
    expect($("#c").classList.contains("bg-muted")).toBe(false);

    entry.env = "Preview";
    await tick();
    expect($("#c").classList.contains("bg-success")).toBe(false);
    expect($("#c").classList.contains("bg-muted")).toBe(true);
  });

  it("match arms split on newlines as well as commas", async () => {
    const entry = await mount(
      `<div id="c" data-p-class="$env {
         Production: bg-success
         Preview: bg-info
         _: bg-muted
       }"></div>`,
      { env: "Preview" },
    );
    expect($("#c").classList.contains("bg-info")).toBe(true);
    expect($("#c").classList.contains("bg-muted")).toBe(false);

    entry.env = "other";
    await tick();
    expect($("#c").classList.contains("bg-info")).toBe(false);
    expect($("#c").classList.contains("bg-muted")).toBe(true);
  });

  it("match form: no matching arm and no _ applies no classes", async () => {
    const entry = await mount(`<div id="c" data-p-class="$env { Production: bg-success }"></div>`, {
      env: "Preview",
    });
    expect($("#c").className).toBe("");

    entry.env = "Production";
    await tick();
    expect($("#c").classList.contains("bg-success")).toBe(true);

    entry.env = "Preview";
    await tick();
    expect($("#c").classList.contains("bg-success")).toBe(false);
  });

  it("true/false arms test truthiness of a predicate discriminant", async () => {
    const entry = await mount(
      `<div id="c" data-p-class="$count > 5 { true: text-danger, false: text-muted }"></div>`,
      { count: 2 },
    );
    expect($("#c").classList.contains("text-muted")).toBe(true);

    entry.count = 9;
    await tick();
    expect($("#c").classList.contains("text-danger")).toBe(true);
    expect($("#c").classList.contains("text-muted")).toBe(false);
  });

  it("=> templates pipe the matched token into {$} holes and swap generated classes", async () => {
    const entry = await mount(
      `<div id="c" data-p-class="$env { Production: success, _: warning } => { border-{$}/30 bg-{$}/10 }"></div>`,
      { env: "Production" },
    );
    expect($("#c").classList.contains("border-success/30")).toBe(true);
    expect($("#c").classList.contains("bg-success/10")).toBe(true);

    entry.env = "Preview";
    await tick();
    expect($("#c").classList.contains("border-warning/30")).toBe(true);
    expect($("#c").classList.contains("border-success/30")).toBe(false);
    expect($("#c").classList.contains("bg-success/10")).toBe(false);
  });

  it("=> templates apply nothing when no arm matches and there is no _", async () => {
    await mount(`<div id="c" data-p-class="$env { Production: success } => { bg-{$} }"></div>`, {
      env: "Preview",
    });
    expect($("#c").className).toBe("");
  });

  it("{$name} template holes substitute raw signal values reactively", async () => {
    const entry = await mount(
      `<div id="c" data-p-class="$on { true: solid } => { border-{$} ring-{$color} }"></div>`,
      { on: true, color: "red" },
    );
    expect($("#c").classList.contains("border-solid")).toBe(true);
    expect($("#c").classList.contains("ring-red")).toBe(true);

    entry.color = "blue";
    await tick();
    expect($("#c").classList.contains("ring-blue")).toBe(true);
    expect($("#c").classList.contains("ring-red")).toBe(false);
  });

  it("bare interpolation groups substitute {$name} holes and swap on change", async () => {
    const entry = await mount(`<div id="c" data-p-class="p-2 bg-{$color}"></div>`, {
      color: "red",
    });
    expect($("#c").classList.contains("bg-red")).toBe(true);
    expect($("#c").classList.contains("p-2")).toBe(true);

    entry.color = "green";
    await tick();
    expect($("#c").classList.contains("bg-green")).toBe(true);
    expect($("#c").classList.contains("bg-red")).toBe(false);
  });
});

describe("data-p-bind", () => {
  it("binds string values to attributes and removes on null", async () => {
    const entry = await mount(`<a id="b" data-p-bind="href:$link"></a>`, {
      link: "/home",
    });
    expect($("#b").getAttribute("href")).toBe("/home");

    entry.link = null;
    await tick();
    expect($("#b").hasAttribute("href")).toBe(false);
  });

  it("boolean true -> empty attribute, false -> removed", async () => {
    const entry = await mount(`<button id="b" data-p-bind="disabled:$busy"></button>`, {
      busy: true,
    });
    expect($("#b").getAttribute("disabled")).toBe("");

    entry.busy = false;
    await tick();
    expect($("#b").hasAttribute("disabled")).toBe(false);
  });

  it('serializes booleans on aria-* as "true"/"false" (never removes on false)', async () => {
    const entry = await mount(`<button id="b" data-p-bind="aria-expanded:$open"></button>`, {
      open: false,
    });
    expect($("#b").getAttribute("aria-expanded")).toBe("false");

    entry.open = true;
    await tick();
    expect($("#b").getAttribute("aria-expanded")).toBe("true");
  });

  it("binds value and checked as element properties", async () => {
    const entry = await mount(
      `<input id="v" data-p-bind="value:$text" />
       <input id="k" type="checkbox" data-p-bind="checked:$on" />`,
      { text: "abc", on: true },
    );
    expect(($("#v") as HTMLInputElement).value).toBe("abc");
    expect(($("#k") as HTMLInputElement).checked).toBe(true);

    entry.text = null;
    entry.on = false;
    await tick();
    expect(($("#v") as HTMLInputElement).value).toBe("");
    expect(($("#k") as HTMLInputElement).checked).toBe(false);
  });

  it("binds indeterminate as an element property", async () => {
    const entry = await mount(
      `<input id="m" type="checkbox" data-p-bind="indeterminate:$mixed" />`,
      { mixed: true },
    );
    expect(($("#m") as HTMLInputElement).indeterminate).toBe(true);
    expect($("#m").hasAttribute("indeterminate")).toBe(false);

    entry.mixed = false;
    await tick();
    expect(($("#m") as HTMLInputElement).indeterminate).toBe(false);
  });

  it("supports multiple bindings, predicates, negation, and literal payloads", async () => {
    const entry = await mount(
      `<div id="b" data-p-bind="data-state:$open -> 'expanded' ~ 'collapsed';aria-busy:not $ready"></div>`,
      { open: false, ready: false },
    );
    expect($("#b").getAttribute("data-state")).toBe("collapsed");
    expect($("#b").getAttribute("aria-busy")).toBe("true");

    entry.open = true;
    entry.ready = true;
    await tick();
    expect($("#b").getAttribute("data-state")).toBe("expanded");
    expect($("#b").getAttribute("aria-busy")).toBe("false");
  });

  it("splits entries on the FIRST colon; quoted ';' and ':' stay in payloads", async () => {
    await mount(
      `<div id="b" data-p-bind="title:$on -> 'a;b: c' ~ 'x';data-alt:$on -> 'y'"></div>`,
      { on: true },
    );
    expect($("#b").getAttribute("title")).toBe("a;b: c");
    expect($("#b").getAttribute("data-alt")).toBe("y");
  });

  it("match form: arm colons inside braces do not break the name split", async () => {
    const entry = await mount(
      `<div id="b" data-p-bind="data-tone:$status { ok: 'good', _: 'bad' }"></div>`,
      { status: "ok" },
    );
    expect($("#b").getAttribute("data-tone")).toBe("good");

    entry.status = "down";
    await tick();
    expect($("#b").getAttribute("data-tone")).toBe("bad");
  });

  it("match form: no matching arm and no _ removes the attribute", async () => {
    const entry = await mount(`<div id="b" data-p-bind="data-tone:$status { ok: 'good' }"></div>`, {
      status: "ok",
    });
    expect($("#b").getAttribute("data-tone")).toBe("good");

    entry.status = "down";
    await tick();
    expect($("#b").hasAttribute("data-tone")).toBe(false);
  });

  it("fallback form: href:$link ~ '/'", async () => {
    const entry = await mount(`<a id="b" data-p-bind="href:$link ~ '/'"></a>`, {
      link: "",
    });
    expect($("#b").getAttribute("href")).toBe("/");

    entry.link = "/docs";
    await tick();
    expect($("#b").getAttribute("href")).toBe("/docs");
  });

  it("stringifies numbers", async () => {
    await mount(`<div id="b" data-p-bind="data-count:$n"></div>`, { n: 42 });
    expect($("#b").getAttribute("data-count")).toBe("42");
  });
});

describe("data-p-style", () => {
  it("sets and removes style properties reactively", async () => {
    const entry = await mount(`<div id="s" data-p-style="background-color->$bg"></div>`, {
      bg: "red",
    });
    expect($("#s").style.getPropertyValue("background-color")).toBe("red");

    entry.bg = null;
    await tick();
    expect($("#s").style.getPropertyValue("background-color")).toBe("");
  });

  it("supports multiple ;-separated properties and stringifies numbers", async () => {
    await mount(`<div id="s" data-p-style="opacity->$fade;z-index->$layer"></div>`, {
      fade: 0.5,
      layer: 10,
    });
    expect($("#s").style.getPropertyValue("opacity")).toBe("0.5");
    expect($("#s").style.getPropertyValue("z-index")).toBe("10");
  });

  it("removes the property on false", async () => {
    const entry = await mount(`<div id="s" data-p-style="opacity->$fade"></div>`, { fade: "1" });
    entry.fade = false;
    await tick();
    expect($("#s").style.getPropertyValue("opacity")).toBe("");
  });
});

describe("store resolution through the DOM", () => {
  it("resolves refs through nested store scopes (nearest wins)", async () => {
    Publr.createStore("outer", () => ({ state: { label: "outer" } }));
    Publr.createStore("inner", () => ({ state: { label: "inner" } }));
    html(`
      <div data-p-store="outer">
        <span id="o" data-p-text="label"></span>
        <div data-p-store="inner"><span id="i" data-p-text="label"></span></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    expect($("#o").textContent).toBe("outer");
    expect($("#i").textContent).toBe("inner");
  });

  it("falls through inner scopes for refs the inner store lacks", async () => {
    Publr.createStore("outer2", () => ({ state: { theme: "dark" } }));
    Publr.createStore("inner2", () => ({ state: { label: "x" } }));
    html(`
      <div data-p-store="outer2">
        <div data-p-store="inner2"><span id="t" data-p-text="theme"></span></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    expect($("#t").textContent).toBe("dark");
  });

  it("qualified refs bypass nested scopes and stay reactive", async () => {
    const cms = Publr.createStore("cms", () => ({
      state: {
        active: false,
        busy: false,
        label: "CMS",
        tone: "blue",
        visible: true,
        width: "12px",
      },
    }))!;
    const editor = Publr.createStore("editor", () => ({
      state: {
        active: true,
        busy: true,
        label: "Editor",
        tone: "red",
        visible: false,
        width: "24px",
      },
    }))!;
    html(`
      <div data-p-store="editor">
        <span id="qualified-text" data-p-text="cms::label"></span>
        <span id="sigiled-text" data-p-text="$cms::label"></span>
        <div id="qualified-show" data-p-show="cms::visible"></div>
        <button id="qualified-bind" data-p-bind="aria-busy:cms::busy"></button>
        <i id="qualified-style" data-p-style="width->cms::width"></i>
        <b id="qualified-class" data-p-class="cms::active -> is-active ~ is-idle"></b>
        <em id="qualified-hole" data-p-class="text-{$cms::tone}-500"></em>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    expect($("#qualified-text").textContent).toBe("CMS");
    expect($("#sigiled-text").textContent).toBe("CMS");
    expect($("#qualified-show").classList.contains("hidden")).toBe(false);
    expect($("#qualified-bind").getAttribute("aria-busy")).toBe("false");
    expect($("#qualified-style").style.width).toBe("12px");
    expect($("#qualified-class").className).toBe("is-idle");
    expect($("#qualified-hole").className).toBe("text-blue-500");

    editor.label = "Still editor";
    editor.visible = true;
    cms.active = true;
    cms.busy = true;
    cms.label = "Updated CMS";
    cms.tone = "green";
    cms.visible = false;
    cms.width = "30px";
    await tick();

    expect($("#qualified-text").textContent).toBe("Updated CMS");
    expect($("#sigiled-text").textContent).toBe("Updated CMS");
    expect($("#qualified-show").classList.contains("hidden")).toBe(true);
    expect($("#qualified-bind").getAttribute("aria-busy")).toBe("true");
    expect($("#qualified-style").style.width).toBe("30px");
    expect($("#qualified-class").className).toBe("is-active");
    expect($("#qualified-hole").className).toBe("text-green-500");
  });

  it("directives outside any store bind nothing (and do not throw)", async () => {
    html(`<span id="t" data-p-text="anything"></span>`);
    expect(() => Publr.hydrate(document)).not.toThrow();
    expect($("#t").textContent).toBe("");
  });

  it("hydrate returns the root and can target a subtree", async () => {
    Publr.createStore("sub", () => ({ state: { msg: "scoped" } }));
    html(`
      <div id="wired" data-p-store="sub"><span data-p-text="msg"></span></div>
      <div id="unwired" data-p-store="sub"><span data-p-text="msg"></span></div>
    `);
    const result = Publr.hydrate($("#wired"));

    // Only the targeted subtree, synchronously: the lifecycle observer wires the
    // other root on its own a microtask later, as it does any markup that arrives.
    expect(result).toBe($("#wired"));
    expect($("#wired span").textContent).toBe("scoped");
    expect($("#unwired span").textContent).toBe("");
    await tick();
    expect($("#unwired span").textContent).toBe("scoped");
  });
});
