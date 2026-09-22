// Island lifecycle: hydrate/destroy, the automatic unmount observer, and
// portals (data-p-portal + Publr.portal/unportal).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRuntime, tick, html, $, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("destroy", () => {
  it("tears down an island: init teardown + effects disposed", async () => {
    const teardown = vi.fn();
    Publr.createLocalStore("w", () => ({
      state: { n: 1 },
      actions: {},
      init: () => teardown,
    }));
    html(`<div id="root" data-p-store="w"><span id="out" data-p-text="n"></span></div>`);
    Publr.hydrate(document);
    await tick();

    const island = $("#root") as any;
    const [state] = island._ps;
    expect($("#out").textContent).toBe("1");

    state.n = 2; // live island reacts
    await tick();
    expect($("#out").textContent).toBe("2");

    Publr.destroy($("#root"));
    expect(teardown).toHaveBeenCalledTimes(1);

    state.n = 99; // disposed effect must not run
    await tick();
    expect($("#out").textContent).toBe("2");
  });

  it("tears down every island inside a subtree", async () => {
    const teardowns = vi.fn();
    Publr.createLocalStore("w", () => ({
      state: {},
      actions: {},
      init: () => teardowns,
    }));
    html(`
      <div id="wrap">
        <div data-p-store="w"></div>
        <div data-p-store="w"></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    Publr.destroy($("#wrap"));
    expect(teardowns).toHaveBeenCalledTimes(2);
  });

  it("is idempotent", async () => {
    const teardown = vi.fn();
    Publr.createLocalStore("w", () => ({
      state: {},
      actions: {},
      init: () => teardown,
    }));
    html(`<div id="root" data-p-store="w"></div>`);
    Publr.hydrate(document);
    await tick();

    Publr.destroy($("#root"));
    Publr.destroy($("#root"));
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("runs automatically when a hydrated island leaves the DOM (unmount observer)", async () => {
    const teardown = vi.fn();
    Publr.createLocalStore("w", () => ({
      state: {},
      actions: {},
      init: () => teardown,
    }));
    html(`<div id="root" data-p-store="w"></div>`);
    Publr.hydrate(document);
    await tick();

    $("#root").remove();
    await tick(); // MutationObserver delivery
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("does NOT dispose islands inside a node that was MOVED, not removed", async () => {
    // A move (insertBefore of an existing node — e.g. a repeater row reorder)
    // reports the node in removedNodes even though it is connected again by
    // the time the observer callback runs. Its islands must survive.
    const teardown = vi.fn();
    Publr.createLocalStore("w", () => ({
      state: { n: 1 },
      actions: {},
      init: () => teardown,
    }));
    html(`
      <div id="wrap">
        <div id="a">first</div>
        <div id="b"><div id="isle" data-p-store="w"><span id="out" data-p-text="n"></span></div></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    // Move #b before #a — same parent, node never leaves the document tree
    // for more than the synchronous insertBefore call.
    $("#wrap").insertBefore($("#b"), $("#a"));
    await tick(); // MutationObserver delivery

    expect(teardown).not.toHaveBeenCalled();
    const island = $("#isle") as any;
    const [state] = island._ps;
    state.n = 2; // island must still be live
    await tick();
    expect($("#out").textContent).toBe("2");
  });
});

describe("hydrate idempotence", () => {
  it("does not double-bind structural templates on re-hydrate", async () => {
    const entry = Publr.createStore("app", () => ({
      state: { items: [{ id: 1, label: "x" }] },
    }))!;
    html(`
      <div data-p-store="app">
        <ul id="list">
          <template data-p-for="item of $items" data-p-key="item.id">
            <li data-p-text="item.label"></li>
          </template>
        </ul>
      </div>
    `);
    Publr.hydrate(document);
    await tick();
    Publr.hydrate(document); // e.g. a second injected-markup pass
    await tick();

    entry.items = [
      { id: 1, label: "x" },
      { id: 2, label: "y" },
    ];
    await tick();
    expect(document.querySelectorAll("#list li").length).toBe(2);
  });

  it("does not duplicate attribute-directive wiring on overlapping hydrates", async () => {
    // Regression: a toggle action wired twice fires twice per click, so its
    // state flips there and back — a visual no-op (gallery canvas frames).
    const entry = Publr.createStore("app", () => ({
      state: { count: 0, open: false },
      actions: {
        inc: () => entry.count++,
        toggle: () => (entry.open = !entry.open),
      },
    }))!;
    html(`
      <div id="root" data-p-store="app">
        <button id="b" data-p-on="click:inc"></button>
        <button id="t" data-p-on="click:toggle"></button>
        <span id="pane" data-p-show="open"></span>
      </div>
    `);
    Publr.hydrate($("#root")); // subtree pass (e.g. a component mount)
    Publr.hydrate(document); // load-time document pass
    await tick();

    $("#b").click();
    expect(entry.count).toBe(1);

    $("#t").click();
    await tick();
    expect(entry.open).toBe(true);
    expect($("#pane").classList.contains("hidden")).toBe(false);
  });

  it("re-wires directives after destroy when the same markup hydrates again", async () => {
    let instances = 0;
    Publr.createLocalStore("w", () => {
      instances++;

      return {
        state: { n: instances * 10 },
        actions: {},
      };
    });
    html(`<div id="root" data-p-store="w"><span id="out" data-p-text="n"></span></div>`);
    Publr.hydrate(document);
    await tick();
    expect($("#out").textContent).toBe("10");

    Publr.destroy($("#root"));
    Publr.hydrate(document);
    await tick();

    expect(instances).toBe(2);
    const island = $("#root") as any;
    expect($("#out").textContent).toBe("20");

    island._ps[0].n = 21; // the re-wired text effect tracks the NEW instance
    await tick();
    expect($("#out").textContent).toBe("21");
  });

  it("does not re-instantiate an already-instantiated local island", async () => {
    let instances = 0;
    Publr.createLocalStore("w", () => {
      instances++;

      return {
        state: {},
        actions: {},
      };
    });
    html(`<div data-p-store="w"></div>`);
    Publr.hydrate(document);
    await tick();
    Publr.hydrate(document);
    await tick();

    expect(instances).toBe(1);
  });
});

describe("portal", () => {
  it("data-p-portal moves the element to the fixed portal root, fully wired", async () => {
    Publr.createLocalStore("menu", () => ({
      state: { label: "item" },
      actions: {},
    }));
    html(`
      <div id="root" data-p-store="menu" style="overflow:hidden">
        <div id="pop" data-p-portal><span id="txt" data-p-text="label"></span></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    const portalRoot = document.getElementById("publr-portal")!;
    expect(portalRoot).not.toBeNull();
    expect($("#pop").parentElement).toBe(portalRoot);
    expect($("#pop").style.pointerEvents).toBe("auto");
    expect($("#txt").textContent).toBe("item");
  });

  it("portaled content still resolves stores through its AUTHORED position", async () => {
    Publr.createLocalStore("menu", () => ({
      state: { label: "a" },
      actions: {},
    }));
    html(`
      <div id="root" data-p-store="menu">
        <div id="pop" data-p-portal><span id="txt" data-p-text="label"></span></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();

    const island = $("#root") as any;
    island._ps[0].label = "b";
    await tick();
    expect($("#txt").textContent).toBe("b");
  });

  it("destroy un-portals content back to its original parent", async () => {
    Publr.createLocalStore("menu", () => ({ state: {}, actions: {} }));
    html(`
      <div id="root" data-p-store="menu">
        <div id="pop" data-p-portal></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();
    expect($("#pop").parentElement!.id).toBe("publr-portal");

    Publr.destroy($("#root"));
    expect($("#pop").parentElement).toBe($("#root"));
    expect($("#pop").style.pointerEvents).toBe("");
  });

  it("carries the .dark class from the authored tree and removes it on restore", async () => {
    Publr.createLocalStore("menu", () => ({ state: {}, actions: {} }));
    html(`
      <div class="dark">
        <div id="root" data-p-store="menu"><div id="pop" data-p-portal></div></div>
      </div>
    `);
    Publr.hydrate(document);
    await tick();
    expect($("#pop").classList.contains("dark")).toBe(true);

    Publr.destroy($("#root"));
    expect($("#pop").classList.contains("dark")).toBe(false);
  });

  it("Publr.portal / Publr.unportal work imperatively and round-trip", () => {
    html(`<div id="host"><div id="float"></div></div>`);
    const float = $("#float");

    const release = Publr.portal(float);
    expect(float.parentElement!.id).toBe("publr-portal");

    release();
    expect(float.parentElement).toBe($("#host"));
  });

  it("portaling twice is a no-op; unportal of a non-portaled element is safe", () => {
    html(`<div id="host"><div id="float"></div></div>`);
    const float = $("#float");

    Publr.portal(float);
    Publr.portal(float);
    expect(document.querySelectorAll("#float").length).toBe(1);

    Publr.unportal(float);
    expect(float.parentElement!.id).toBe("host");
    expect(() => Publr.unportal(float)).not.toThrow();
  });

  it("positions a portaled panel from its authored trigger and requested alignment", async () => {
    Publr.createLocalStore("menu-position", () => ({ state: {}, actions: {} }));
    html(`
      <div id="root" data-p-store="menu-position">
        <button id="trigger" data-p-anchor></button>
        <div id="panel" data-p-portal data-p-position="right"></div>
      </div>
    `);
    const trigger = $("#trigger");
    const panel = $("#panel");
    (trigger as any).getBoundingClientRect = () => ({
      top: 100,
      right: 300,
      bottom: 140,
      left: 200,
      width: 100,
      height: 40,
    });
    (panel as any).getBoundingClientRect = () => ({
      top: 0,
      right: 0,
      bottom: 60,
      left: 0,
      width: 80,
      height: 60,
    });

    Publr.hydrate(document);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(panel.parentElement?.id).toBe("publr-portal");
    expect(panel.dataset.placement).toBe("bottom-end");
    expect(panel.style.top).toBe("144px");
    expect(panel.style.left).toBe("220px");
  });

  it("remeasures after trigger or panel sizing changes", async () => {
    let notifyResize = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = () => callback([], this as unknown as ResizeObserver);
        }
        observe = observe;
        disconnect = disconnect;
      },
    );

    try {
      Publr.createLocalStore("menu-resize", () => ({ state: {}, actions: {} }));
      html(`
        <div id="root" data-p-store="menu-resize">
          <button id="trigger" data-p-anchor></button>
          <div id="panel" data-p-portal data-p-position="right" data-publr-position-offset="2"></div>
        </div>
      `);
      const trigger = $("#trigger");
      const panel = $("#panel");
      let triggerRect = {
        top: 100,
        right: 300,
        bottom: 140,
        left: 200,
        width: 100,
        height: 40,
      };
      let panelRect = {
        top: 0,
        right: 0,
        bottom: 60,
        left: 0,
        width: 80,
        height: 60,
      };
      (trigger as any).getBoundingClientRect = () => triggerRect;
      (panel as any).getBoundingClientRect = () => panelRect;

      Publr.hydrate(document);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(panel.style.top).toBe("142px");
      expect(panel.style.left).toBe("220px");
      expect(observe).toHaveBeenCalledWith(trigger);
      expect(observe).toHaveBeenCalledWith(panel);

      triggerRect = { ...triggerRect, right: 260, bottom: 180 };
      panelRect = { ...panelRect, width: 160 };
      notifyResize();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(panel.style.top).toBe("182px");
      expect(panel.style.left).toBe("100px");
    } finally {
      Publr.destroy($("#root"));
      expect(disconnect).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
    }
  });

  it("positions an opening panel on its next animation frame", async () => {
    Publr.createLocalStore("menu-open-position", () => ({ state: {}, actions: {} }));
    html(`
      <div id="root" data-p-store="menu-open-position">
        <button id="trigger" data-p-anchor aria-expanded="false"></button>
        <div id="panel" data-p-portal data-p-position="right" data-publr-position-offset="2" hidden></div>
      </div>
    `);
    const trigger = $("#trigger");
    const panel = $("#panel");
    (trigger as any).getBoundingClientRect = () => ({
      top: 100,
      right: 300,
      bottom: 140,
      left: 200,
      width: 100,
      height: 40,
    });
    (panel as any).getBoundingClientRect = () => ({
      top: 0,
      right: 0,
      bottom: 60,
      left: 0,
      width: 80,
      height: 60,
    });

    Publr.hydrate(document);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let positionFrame: FrameRequestCallback | undefined;
    const deferredFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        positionFrame = callback;
        return 41;
      });

    try {
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      await tick();

      expect(panel.style.top).toBe("");
      expect(panel.style.left).toBe("");
      expect(deferredFrame).toHaveBeenCalled();

      positionFrame!(0);

      expect(panel.style.top).toBe("142px");
      expect(panel.style.left).toBe("220px");
      expect(panel.style.getPropertyValue("--publr-anchor-width")).toBe("100px");
      expect(panel.dataset.placement).toBe("bottom-end");
    } finally {
      Publr.destroy($("#root"));
      deferredFrame.mockRestore();
    }
  });

  it("dispatches dismiss when pointer interaction lands outside the authored root", async () => {
    Publr.createLocalStore("menu-dismiss", () => ({ state: {}, actions: {} }));
    html(`
      <div id="root" data-p-store="menu-dismiss">
        <button data-p-anchor></button>
        <div id="panel" data-p-portal data-p-position="left"></div>
      </div>
      <button id="outside"></button>
    `);
    const panel = $("#panel");
    let reason = "";
    panel.addEventListener("dismiss", (event) => {
      reason = (event as CustomEvent<{ reason: string }>).detail.reason;
    });

    Publr.hydrate(document);
    $("#outside").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await tick();

    expect(reason).toBe("pointer");
  });

  it("wires position before portal removes the panel from a subtree hydration root", async () => {
    Publr.createLocalStore("menu-subtree", () => ({ state: {}, actions: {} }));
    html(`
      <div id="host">
        <div id="root" data-p-store="menu-subtree">
          <button data-p-anchor></button>
          <div id="panel" data-p-position="left" data-p-portal></div>
        </div>
      </div>
      <button id="outside"></button>
    `);
    let dismissed = false;
    $("#panel").addEventListener("dismiss", () => (dismissed = true));

    Publr.hydrate($("#host"));
    $("#outside").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await tick();

    expect(dismissed).toBe(true);
  });
});
