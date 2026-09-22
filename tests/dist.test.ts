import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { tick } from "./helpers";
// @ts-expect-error built modules
import * as dom from "../dist/publr-dom.js";
// @ts-expect-error built modules
import * as runtime from "../dist/publr-runtime.js";
// @ts-expect-error built modules
import { invalidate } from "../dist/publr-query.js";

it("ships the compiled DOM target without a legacy JSX entry or generic element API", () => {
  expect(existsSync("dist/publr-jsx.js")).toBe(false);
  expect(dom.h).toBeUndefined();
  expect(typeof dom.mount).toBe("function");
  const code = readFileSync("dist/publr-dom.js", "utf8");
  expect(code).not.toContain("WebAssembly");
  expect(code).not.toContain("createQueryCache");
});
it("built DOM and cached async values use the same reactive graph", async () => {
  const root = document.createElement("div");
  const count = runtime.state(1);
  expect(typeof invalidate).toBe("function");
  const value = runtime.awaited(() => count.read() * 2, {
    cache: () => ({ key: ["dist-count", count.read()], ttl: 1000 }),
  });
  const dispose = dom.mount(root, () =>
    dom.element("output", (el: Element) =>
      dom.append(
        el,
        dom.text(() => value.read()),
      ),
    ),
  );
  expect(root.textContent).toBe("2");
  count.write(3);
  await tick();
  expect(root.textContent).toBe("6");
  dispose();
});
