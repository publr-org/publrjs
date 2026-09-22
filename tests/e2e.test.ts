// The acceptance bar for the runtime: the Counter and TodoList fixtures, authored
// in PJSX and compiled by the Zig compiler (`npm run fixtures`), mounted against
// the real runtime and reactivity. This is where the compiler's output and the
// runtime's contract meet; a change to either side that breaks the other lands
// here first.

import { beforeEach, describe, expect, it } from "vitest";
import { loadJsx, loadRuntime, tick, type Jsx } from "./helpers";
import { data, ui } from "./fixtures/state";

// @ts-expect-error — compiled fixture, no declaration file
import { App } from "./fixtures/App.js";
// @ts-expect-error — compiled fixture, no declaration file
import { Counter } from "./fixtures/Counter.js";
// @ts-expect-error — compiled fixture, no declaration file
import { Host } from "./fixtures/Host.js";

// @ts-expect-error — compiled fixture, no declaration file
import { PropSemantics, resetDefaultCalls, getDefaultCalls } from "./fixtures/PropSemantics.js";

let jsx: Jsx;

beforeEach(async () => {
  await loadRuntime();
  jsx = await loadJsx();
  ui.label = "Clicks";
});

function host(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("end to end: Counter", () => {
  it("renders reactive state while destructured props retain JavaScript snapshot semantics", async () => {
    const root = host();
    jsx.mount(root, () => App({}));

    const button = root.querySelector("button")!;
    expect(button.textContent).toBe("Clicks: 3");
    expect(button.classList.contains("counter")).toBe(true);
    expect(button.classList.contains("counter--active")).toBe(true);

    button.click();
    await tick();
    expect(button.textContent).toBe("Clicks: 4");

    // A destructured parameter is a snapshot, exactly as in JavaScript.
    // Reading props.label in JSX is the explicit form for a live property.
    ui.label = "Taps";
    await tick();
    expect(button.textContent).toBe("Clicks: 4");
    expect(root.querySelector("button")).toBe(button);
  });

  it("applies defaults when props are absent", () => {
    const root = host();
    jsx.mount(root, () => Counter({}));
    expect(root.querySelector("button")!.textContent).toBe("Count: 0");
  });
});

describe("end to end: TodoList", () => {
  const setup = async () => {
    const root = host();
    jsx.mount(root, () => Host({}));
    await tick();
    return root;
  };

  it("renders the whole tree: heading, keyed rows, slot children", async () => {
    const root = await setup();

    expect(root.querySelector("h2")!.textContent).toBe("Launch · 2 remaining");
    expect(root.querySelectorAll("li").length).toBe(data.length);
    expect(root.querySelector("section")!.classList.contains("is-open")).toBe(true);
    expect(root.querySelector("footer small")!.textContent).toBe("auto-saved");
    expect(root.querySelector("li .t")!.textContent).toBe("Reopen: Finish design");
    expect(root.querySelector("li .r")!.getAttribute("aria-label")).toBe("Remove Finish design");
    expect(root.querySelector("p.empty")!.classList.contains("hidden")).toBe(true);
    expect(root.querySelector("ul")!.classList.contains("hidden")).toBe(false);
  });

  it("toggling and removing rows updates fine-grained", async () => {
    const root = await setup();
    const rows = () => [...root.querySelectorAll("li")];
    const secondRow = rows()[1]!;

    secondRow.querySelector<HTMLElement>(".t")!.click();
    await tick();
    expect(root.querySelector("h2")!.textContent).toBe("Launch · 1 remaining");
    expect(secondRow.classList.contains("is-done")).toBe(true);
    expect(rows()[1]).toBe(secondRow);

    rows()[0]!.querySelector<HTMLElement>(".r")!.click();
    await tick();
    expect(rows().length).toBe(2);
    expect(rows()[0]).toBe(secondRow);
  });

  it("JSX control flow unmounts the body and :text swaps the toggle label", async () => {
    const root = await setup();
    const toggle = root.querySelector<HTMLElement>(".toggle-open")!;
    expect(toggle.textContent).toBe("Hide");

    toggle.click();
    await tick();
    expect(root.querySelector(".body")).toBeNull();
    expect(toggle.textContent).toBe("Show");
    expect(root.querySelector("section")!.classList.contains("is-open")).toBe(false);

    toggle.click();
    await tick();
    expect(root.querySelector(".body")).not.toBeNull();
    expect(root.querySelectorAll("li").length).toBe(3);
  });

  it("emptying the list flips :show both ways and marks the section", async () => {
    const root = await setup();

    for (let i = 0; i < 3; i++) {
      root.querySelector<HTMLElement>("li .r")!.click();
      await tick();
    }

    expect(root.querySelectorAll("li").length).toBe(0);
    expect(root.querySelector("p.empty")!.classList.contains("hidden")).toBe(false);
    expect(root.querySelector("ul")!.classList.contains("hidden")).toBe(true);
    expect(root.querySelector("section")!.classList.contains("is-empty")).toBe(true);
    expect(root.querySelector("h2")!.textContent).toBe("Launch · 0 remaining");
  });
});

describe("end to end: TypeScript props and Publr JSX guards", () => {
  it("evaluates a destructuring default once for undefined, preserving null and zero", () => {
    resetDefaultCalls();
    const absent = host();
    jsx.mount(absent, () => PropSemantics({}));
    expect(absent.querySelector("output")!.textContent).toBe("1.25");
    expect(getDefaultCalls()).toBe(1);

    const explicitUndefined = host();
    jsx.mount(explicitUndefined, () => PropSemantics({ value: undefined }));
    expect(explicitUndefined.querySelector("output")!.textContent).toBe("1.25");
    expect(getDefaultCalls()).toBe(2);

    const explicitNull = host();
    jsx.mount(explicitNull, () => PropSemantics({ value: null }));
    expect(explicitNull.querySelector("output")!.textContent).toBe("");
    const zero = host();
    jsx.mount(zero, () => PropSemantics({ value: 0 }));
    expect(zero.querySelector("output")!.textContent).toBe("0");
    expect(getDefaultCalls()).toBe(2);
  });

  it("tests booleans for true and optional strings/numbers for presence, including map scopes", () => {
    const root = host();
    jsx.mount(root, () =>
      PropSemantics({
        enabled: false,
        label: "",
        count: 0,
        items: [{ label: "", enabled: false }, { label: "Shown", enabled: true }, {}],
      }),
    );
    expect(root.querySelector("[data-enabled]")).toBeNull();
    expect(root.querySelector("[data-label]")).not.toBeNull();
    expect(root.querySelector("[data-count]")!.textContent).toBe("0");
    expect(root.querySelectorAll("[data-row-label]")).toHaveLength(2);
    expect(root.querySelectorAll("[data-row-enabled]")).toHaveLength(1);
    expect(root.querySelectorAll("[data-outer-label]")).toHaveLength(3);

    const absent = host();
    jsx.mount(absent, () => PropSemantics({}));
    expect(absent.querySelector("[data-label], [data-count], [data-enabled]")).toBeNull();
  });

  it("keeps explicit object-property reads live without reevaluating defaults", async () => {
    resetDefaultCalls();
    const root = host();
    jsx.mount(root, () => PropSemantics({ live: ui }));
    expect(root.querySelector("[data-live]")!.textContent).toBe("Clicks");
    ui.label = "Taps";
    await tick();
    expect(root.querySelector("[data-live]")!.textContent).toBe("Taps");
    expect(root.querySelector("output")!.textContent).toBe("1.25");
    expect(getDefaultCalls()).toBe(1);
  });
});
