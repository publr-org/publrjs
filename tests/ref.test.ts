import { beforeEach, describe, expect, it } from "vitest";
import { $, html, loadRuntime, type Runtime } from "./helpers";

let rt: Runtime;
let Publr: Runtime["Publr"];

beforeEach(async () => {
  rt = await loadRuntime();
  Publr = rt.Publr;
});

describe("ref", () => {
  it("is a callable ref for direct DOM mounting", () => {
    const buttonRef = rt.ref<HTMLButtonElement | null>();
    const button = document.createElement("button");

    expect(buttonRef.current).toBeNull();
    buttonRef(button);
    expect(buttonRef.current).toBe(button);
    buttonRef(null);
    expect(buttonRef.current).toBeNull();
  });

  it("restores data-p-ref inside a local island and clears it on destroy", () => {
    const buttonRef = rt.ref<HTMLButtonElement | null>();
    Publr.createLocalStore("controls", () => ({
      state: {},
      actions: {},
      refs: { buttonRef },
    }));
    html(`
      <div id="root" data-p-store="controls">
        <button id="button" data-p-ref="buttonRef"></button>
      </div>
    `);

    Publr.hydrate(document);
    expect(buttonRef.current).toBe($("#button"));

    Publr.destroy($("#root"));
    expect(buttonRef.current).toBeNull();
  });
});

it("composes refs from nested islands and cleans each mounted collection entry", () => {
  const entries = new Set<Element>();
  let cleanups = 0;
  const collection = rt.ref<Element>((element) => {
    entries.add(element);
    return () => {
      entries.delete(element);
      cleanups++;
    };
  });
  const trigger = rt.ref<Element>();
  Publr.createLocalStore("parent", () => ({ state: {}, actions: {}, refs: { collection } }));
  Publr.createLocalStore("child", () => ({ state: {}, actions: {}, refs: { trigger } }));
  html(
    `<div id="root" data-p-store="parent"><div id="child" data-p-store="child"><button id="one" data-p-ref="trigger;collection"></button></div><button id="two" data-p-ref="collection"></button></div>`,
  );
  Publr.hydrate(document);
  expect(trigger.current).toBe($("#one"));
  expect(entries.size).toBe(2);
  Publr.destroy($("#child"));
  expect(trigger.current).toBeNull();
  expect([...entries]).toEqual([$("#two")]);
  Publr.destroy($("#root"));
  expect(entries.size).toBe(0);
  expect(cleanups).toBe(2);
});
