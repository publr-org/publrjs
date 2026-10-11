// Structural template directive: data-p-for (keyed lists).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRuntime, tick, html, $, $$, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("data-p-for", () => {
  it("binds row attributes before refs mount and releases removed rows and their islands", async () => {
    const mounted: string[] = [];
    const released: string[] = [];
    let clicks = 0;
    let childReleased = 0;
    Publr.createLocalStore("child", () => ({
      state: {},
      refs: {
        root: Publr.ref(() => () => {
          childReleased++;
        }),
      },
    }));
    const state = rt.reactive({ items: [{ id: 7 }] });
    Publr.createLocalStore("app", () => ({
      state,
      refs: {
        row: Publr.ref((el: HTMLElement) => {
          mounted.push(el.dataset.id!);
          return () => {
            released.push(el.dataset.id!);
          };
        }),
      },
      actions: {
        click() {
          clicks++;
        },
      },
    }));
    html(
      '<div data-p-store="app"><template data-p-for="item of $items" data-p-key="$item.id"><button data-p-ref="row" data-p-bind="data-id:$item.id" data-p-on="click:click"><span data-p-store="child" data-p-ref="root"></span></button></template></div>',
    );
    Publr.hydrate(document);
    await tick();
    const button = $("button");
    expect(mounted).toEqual(["7"]);
    button.click();
    expect(clicks).toBe(1);
    state.items.splice(0);
    await tick();
    expect(released).toEqual(["7"]);
    expect(childReleased).toBe(1);
    button.click();
    expect(clicks).toBe(1);
  });

  async function mountList(state: Record<string, any>, extra = "") {
    const entry = Publr.createStore("app", () => ({ state, actions: {} }))!;
    html(`
      <div data-p-store="app">
        <ul id="list">
          <template data-p-for="item of $items" data-p-key="item.id">
            <li data-p-text="item.label">${extra}</li>
          </template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();
    return entry;
  }

  const labels = () => $$("#list li").map((li) => li.textContent);

  it("renders one clone per item with alias bindings", async () => {
    await mountList({
      items: [
        { id: 1, label: "Alpha" },
        { id: 2, label: "Beta" },
      ],
    });
    expect(labels()).toEqual(["Alpha", "Beta"]);
  });

  it("qualified list refs bypass the nearest store", async () => {
    const cms = Publr.createStore("cms", () => ({
      state: { items: [{ id: 1, label: "CMS item" }] },
    }))!;
    Publr.createStore("editor", () => ({
      state: { items: [{ id: 2, label: "Editor item" }] },
    }));
    html(`
      <div data-p-store="editor">
        <ul id="list">
          <template data-p-for="item of cms::items" data-p-key="item.id">
            <li data-p-text="item.label"></li>
          </template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    expect(labels()).toEqual(["CMS item"]);
    cms.items = [{ id: 3, label: "Updated CMS item" }];
    await tick();
    expect(labels()).toEqual(["Updated CMS item"]);
  });

  it("appends, removes, and reorders keyed items — reusing DOM nodes", async () => {
    const entry = await mountList({
      items: [
        { id: 1, label: "Alpha" },
        { id: 2, label: "Beta" },
      ],
    });
    const [alphaNode, betaNode] = $$("#list li");

    entry.items = [
      { id: 2, label: "Beta" },
      { id: 3, label: "Gamma" },
      { id: 1, label: "Alpha" },
    ];
    await tick();

    expect(labels()).toEqual(["Beta", "Gamma", "Alpha"]);
    const after = $$("#list li");
    expect(after[0]).toBe(betaNode); // keyed nodes moved, not recreated
    expect(after[2]).toBe(alphaNode);

    entry.items = [{ id: 3, label: "Gamma" }];
    await tick();
    expect(labels()).toEqual(["Gamma"]);
  });

  it("updates in place when an item's property changes", async () => {
    const entry = await mountList({ items: [{ id: 1, label: "Alpha" }] });
    entry.items[0].label = "Renamed";
    await tick();
    expect(labels()).toEqual(["Renamed"]);
  });

  it("falls back to index keys without data-p-key", async () => {
    const entry = Publr.createStore("idx", () => ({
      state: { items: ["a", "b"] },
    }))!;
    html(`
      <div data-p-store="idx">
        <ul id="list">
          <template data-p-for="item of $items"><li data-p-text="item"></li></template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();
    expect(labels()).toEqual(["a", "b"]);

    entry.items = ["a", "b", "c"];
    await tick();
    expect(labels()).toEqual(["a", "b", "c"]);
  });

  it("renders empty and repopulates", async () => {
    const entry = await mountList({ items: [{ id: 1, label: "One" }] });
    entry.items = [];
    await tick();
    expect(labels()).toEqual([]);

    entry.items = [{ id: 9, label: "Nine" }];
    await tick();
    expect(labels()).toEqual(["Nine"]);
  });

  it("clones can reach parent-store actions and pass item data through the dataset", async () => {
    const removed: string[] = [];
    const entry = Publr.createStore("todo", () => ({
      state: {
        items: [
          { id: "a", label: "First" },
          { id: "b", label: "Second" },
        ],
      },
      actions: {
        remove(dataset: { id: string }) {
          removed.push(dataset.id);
          entry.items = entry.items.filter((item: { id: string }) => item.id !== dataset.id);
        },
      },
    }))!;
    html(`
      <div data-p-store="todo">
        <ul id="list">
          <template data-p-for="item of $items" data-p-key="item.id">
            <li>
              <span data-p-text="item.label"></span>
              <button data-p-bind="data-id:item.id" data-p-on="click:remove"></button>
            </li>
          </template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    $$("#list button")[0].click();
    await tick();

    expect(removed).toEqual(["a"]);
    expect($$("#list li span").map((s) => s.textContent)).toEqual(["Second"]);
  });

  it("supports nested for loops through the alias chain", async () => {
    Publr.createStore("matrix", () => ({
      state: {
        rows: [
          { id: "r1", cells: [{ id: "c1", v: "1-1" }] },
          {
            id: "r2",
            cells: [
              { id: "c2", v: "2-1" },
              { id: "c3", v: "2-2" },
            ],
          },
        ],
      },
    }));
    html(`
      <div data-p-store="matrix">
        <div id="grid">
          <template data-p-for="row of $rows" data-p-key="row.id">
            <div class="row">
              <template data-p-for="cell of row.cells" data-p-key="cell.id">
                <span data-p-text="cell.v"></span>
              </template>
            </div>
          </template>
        </div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    expect($$(".row").length).toBe(2);
    expect($$("#grid span").map((s) => s.textContent)).toEqual(["1-1", "2-1", "2-2"]);
  });

  it("disposes item scopes when items are removed (listeners detach)", async () => {
    const hit = vi.fn();
    const entry = Publr.createStore("evts", () => ({
      state: { items: [{ id: 1, label: "x" }] },
      actions: { hit },
    }))!;
    html(`
      <div data-p-store="evts">
        <ul id="list">
          <template data-p-for="item of $items" data-p-key="item.id">
            <li><button data-p-on="click:hit"></button></li>
          </template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    const button = $("#list button");
    button.click();
    expect(hit).toHaveBeenCalledTimes(1);

    entry.items = [];
    await tick();
    button.click(); // detached node; scope disposed
    expect(hit).toHaveBeenCalledTimes(1);
  });
});

describe("server-rendered structural regions", () => {
  it("adopts nested server rows, reading an id-only loop anchor from the prototype", async () => {
    const store = Publr.createStore("table", () => ({
      state: { rows: [{ id: "one", cells: [{ id: "title", text: "Initial" }] }] },
    }))!;
    html(`<div data-p-store="table"><section>
      <template data-p-template="rows" data-p-for="row of $rows" data-p-key="$row.id"><div class="row">
        <template data-p-template="cells" data-p-for="cell of $row.cells" data-p-key="$cell.id"><span class="cell" data-p-text="$cell.text"></span></template>
      </div></template>
      <div class="row" data-p-for-key='"one"'>
        <template data-p-template="cells" data-p-for></template>
        <span class="cell" data-p-for-key='"title"' data-p-text="$cell.text">Initial</span>
      </div>
    </section></div>`);
    const row = $(".row");
    const cell = $(".cell");
    Publr.hydrate(document);
    await tick();
    expect($(".row")).toBe(row);
    expect($(".cell")).toBe(cell);
    expect(cell.textContent).toBe("Initial");
    expect($$("[data-p-for-key]")).toHaveLength(0);
    store.rows = [{ id: "one", cells: [{ id: "title", text: "Updated" }] }];
    await tick();
    expect($(".row")).toBe(row);
    expect($(".cell")).toBe(cell);
    expect(cell.textContent).toBe("Updated");
    store.rows = [
      {
        id: "one",
        cells: [
          { id: "title", text: "Split" },
          { id: "extra", text: "More" },
        ],
      },
    ];
    await tick();
    expect($$(".cell").map((el) => el.textContent)).toEqual(["Split", "More"]);
    store.rows = [];
    await tick();
    expect($$(".row")).toHaveLength(0);
  });

  it("reads an id-only anchor's condition and inversion from its prototype", async () => {
    const store = Publr.createStore("list", () => ({
      state: { open: true, items: [{ id: "a" }] },
    }))!;
    html(`<div data-p-store="list"><section>
      <template data-p-template="rows" data-p-for="item of $items" data-p-key="$item.id"><div class="row">
        <template data-p-template="closed" data-p-if="$open" data-p-if-not><em>closed</em></template>
        <template data-p-template="opened" data-p-if="$open"><b>open</b></template>
      </div></template>
      <div class="row" data-p-for-key='"a"'>
        <template data-p-template="closed" data-p-if data-p-if-not></template>
        <template data-p-template="opened" data-p-if></template>
        <b data-p-if-row>open</b>
      </div>
    </section></div>`);
    Publr.hydrate(document);
    await tick();
    expect($$(".row b")).toHaveLength(1);
    expect($$(".row em")).toHaveLength(0);
    store.open = false;
    await tick();
    expect($$(".row b")).toHaveLength(0);
    expect($(".row em").textContent).toBe("closed");
  });

  it("resolves shared prototypes through nested local stores and keeps instances separate", async () => {
    Publr.createLocalStore("nested", () => ({ state: {} }));
    const one = Publr.createStore("one", () => ({ state: { open: true, items: ["A"] } }))!;
    const two = Publr.createStore("two", () => ({ state: { open: true, items: ["B"] } }))!;
    html(
      ["one", "two"]
        .map(
          (name) => `<section data-p-store="${name}">
      <template data-p-template="outer" data-p-if="$open"><div data-p-store="nested">
        <template data-p-template="inner" data-p-for="item of $items"><p>${name}:<span data-p-text="$item"></span></p></template>
      </div></template>
      <div data-p-if-row data-p-store="nested">
        <template data-p-template="inner" data-p-for="item of $items"></template>
        <p data-p-for-key="0">${name}:<span data-p-text="$item">${name === "one" ? "A" : "B"}</span></p>
      </div>
    </section>`,
        )
        .join(""),
    );
    Publr.hydrate(document);
    await tick();
    one.items = ["C", "D"];
    two.items = ["E", "F"];
    await tick();
    expect($$("section p").map((el) => el.textContent)).toEqual([
      "one:C",
      "one:D",
      "two:E",
      "two:F",
    ]);
  });

  it("adopts a conditional island, retains it while true, and releases it when removed", async () => {
    let mounts = 0;
    let releases = 0;
    Publr.createLocalStore("menu", () => ({
      state: {},
      refs: {
        root: Publr.ref(() => {
          mounts++;
          return () => {
            releases++;
          };
        }),
      },
    }));
    const store = Publr.createStore("view", () => ({ state: { open: true } }))!;
    html(`<div data-p-store="view">
      <template data-p-if="$open"><div data-p-store="menu" data-p-ref="root">Menu</div></template>
      <div data-p-if-row data-p-store="menu" data-p-ref="root">Menu</div>
      <template data-p-if="$open" data-p-if-not><p>Closed</p></template>
    </div>`);
    const initial = $("[data-p-if-row]");
    Publr.hydrate(document);
    await tick();
    expect($("[data-p-store=menu]")).toBe(initial);
    expect(mounts).toBe(1);
    store.open = false;
    await tick();
    expect(releases).toBe(1);
    expect($$("[data-p-store=menu]")).toHaveLength(0);
    expect($("p").textContent).toBe("Closed");
    store.open = true;
    await tick();
    expect(mounts).toBe(2);
    expect($$("p")).toHaveLength(0);
    expect($("[data-p-store=menu]")).not.toBe(initial);
  });
});
