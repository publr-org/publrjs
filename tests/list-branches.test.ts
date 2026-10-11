// A list row that is a conditional, or a row with branches inside it, reads
// the row's item. Toggling a row's flag and replacing the whole list must
// settle, never loop. Runs the actual `pjsx dom` output of
// tests/compiled/RowBranches.ptsx: `.map((row) => row.on && <X/>)`, a ternary
// between two components as the row, and both inside an `<li>` row.
import { expect, it } from "vitest";
import { mount } from "../src/addons/dom";
import { tick } from "./helpers";

const html = (host: Element, selector: string) =>
  host.querySelector(selector)!.innerHTML.replace(/<!--[^>]*-->/g, "");
const rows = (host: Element) =>
  [...host.querySelectorAll("li")].map((li) => li.innerHTML.replace(/<!--[^>]*-->/g, ""));
const flip = (host: Element, id: number) =>
  [...host.querySelectorAll("nav button")]
    .find((button) => button.textContent === String(id))!
    .dispatchEvent(new MouseEvent("click"));
const click = (host: Element, selector: string) =>
  host.querySelector(selector)!.dispatchEvent(new MouseEvent("click"));

it("settles when a conditional row toggles and the list is replaced", async () => {
  // @ts-expect-error compiler output
  const { RowBranches } = await import("./compiled/RowBranches.js");
  const host = document.createElement("div");
  const dispose = mount(host, RowBranches);
  const expectShown = (on: Record<number, boolean>) => {
    const ids = Object.keys(on).map(Number);
    expect(html(host, ".guard")).toBe(
      ids
        .filter((id) => on[id])
        .map((id) => `<span>${id}</span>`)
        .join(""),
    );
    expect(html(host, ".ternary")).toBe(
      ids.map((id) => `<em>${on[id] ? "on" : "off"}</em>`).join(""),
    );
    expect(rows(host)).toEqual(
      ids.map((id) => (on[id] ? "<span>x</span><em>on</em>" : "<em>off</em>")),
    );
  };
  expectShown({ 1: false, 2: true });

  const kept = host.querySelector(".ternary em:last-child");
  flip(host, 1);
  await tick();
  expectShown({ 1: true, 2: true });
  expect(host.querySelector(".ternary em:last-child")).toBe(kept);

  click(host, "button.replace");
  await tick();
  expectShown({ 1: false, 2: false });

  click(host, "button.swap");
  await tick();
  expectShown({ 2: true, 3: false });

  flip(host, 3);
  await tick();
  expectShown({ 2: true, 3: true });
  dispose();
});
