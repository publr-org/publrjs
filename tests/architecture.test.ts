import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const coreDirectory = join(dirname(fileURLToPath(import.meta.url)), "../src/core");

describe("core architecture", () => {
  it("contains no concrete component anatomy or component-specific wires", () => {
    const source = readdirSync(coreDirectory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(coreDirectory, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/data-part|data-publr-component/);
    expect(source).not.toMatch(/wire(?:Accordion|Menu|Select|UnitControl)/);
    expect(source).not.toMatch(/data-p-(?:accordion|menu|select|unit-control)/);
  });
});
