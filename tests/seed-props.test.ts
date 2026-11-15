import { describe, expect, it } from "vitest";
import { createLocalStore, createStoreContainer, hydrate, destroy } from "../src/publr";

describe("a local store's props from its seed", () => {
  it("hands the factory each `$<prop>` and keeps them out of state", () => {
    const host = document.createElement("div");
    host.innerHTML = `<p data-p-store="SeedProps" data-p='{"up":true,"$direction":"up","$props":{"name":"shop"}}'></p>`;
    document.body.append(host);
    const container = createStoreContainer({ root: host });
    const seen: Array<Record<string, unknown> | undefined> = [];
    const states: any[] = [];
    createLocalStore("SeedProps", ({ state, props }) => {
      seen.push(props);
      states.push(state);
      return { state: { up: false } };
    });
    try {
      hydrate(host);
      expect(seen).toEqual([{ direction: "up", name: "shop" }]);
      expect(states[0].up).toBe(true);
      expect("$direction" in states[0]).toBe(false);
      expect("$props" in states[0]).toBe(false);
    } finally {
      destroy(host);
      container.dispose();
      host.remove();
    }
  });
});
