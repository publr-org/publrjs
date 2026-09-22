// The table-driven merge pins the JIT's conflict semantics 1:1 with
// jit/src/class_merge.zig's own tests: same scope + the later class owns every
// property of the earlier one ⇒ the earlier one drops.

import { beforeEach, describe, expect, it } from "vitest";
import { TEST_CLASS_GROUPS } from "./helpers";
import * as jsx from "../src/addons/class-merge";

beforeEach(async () => {
  jsx.useClassGroups(TEST_CLASS_GROUPS);
});

const merge = (input: string) => jsx.mergeClasses(input);

describe("mergeClasses (table-driven)", () => {
  it("caller utility wins within the same class group", () => {
    expect(merge("w-8 px-2.5 px-0")).toBe("w-8 px-0");
    expect(merge("bg-red-500 bg-blue-500")).toBe("bg-blue-500");
    expect(merge("hover:bg-red-500 hover:bg-blue-500")).toBe("hover:bg-blue-500");
  });

  it("directional groups preserve partial overrides", () => {
    expect(merge("p-4 px-2")).toBe("p-4 px-2");
    expect(merge("px-2 p-4")).toBe("p-4");
    expect(merge("rounded rounded-t-none")).toBe("rounded rounded-t-none");
    expect(merge("rounded-t-none rounded")).toBe("rounded");
  });

  it("variants, important, and arbitrary properties keep independent scopes", () => {
    expect(merge("hover:px-4 focus:px-2")).toBe("hover:px-4 focus:px-2");
    expect(merge("p-4! p-2")).toBe("p-4! p-2");
    expect(merge("p-4! p-2!")).toBe("p-2!");
    expect(merge("p-2 [padding:1px]")).toBe("p-2 [padding:1px]");
  });

  it("font size and line-height use directional conflict semantics", () => {
    expect(merge("text-sm leading-8")).toBe("text-sm leading-8");
    expect(merge("leading-8 text-lg")).toBe("text-lg");
  });

  it("keeps untabled classes verbatim and never conflicts them", () => {
    expect(merge("counter counter--active px-0 counter")).toBe(
      "counter counter--active px-0 counter",
    );
    expect(merge("")).toBe("");
  });

  it("consults the installed resolver once per unknown class, synchronously", () => {
    const asked: string[][] = [];
    jsx.setClassResolver((classes) => {
      asked.push([...classes]);
      return Object.fromEntries(
        classes
          .filter((cls) => cls.startsWith("size-"))
          .map((cls) => [cls, ["base", ["width", "height"]]]),
      );
    });
    try {
      expect(merge("size-4 size-5 unknown-thing")).toBe("size-5 unknown-thing");
      expect(merge("size-4 size-5 unknown-thing")).toBe("size-5 unknown-thing");
      expect(asked).toEqual([["size-4", "size-5", "unknown-thing"]]);
      // A null answer ("engine not ready") caches nothing and is retried.
      jsx.setClassResolver(() => null);
      expect(merge("mt-3 mt-4")).toBe("mt-3 mt-4");
      jsx.setClassResolver(() => ({
        "mt-3": ["base", ["margin-top"]],
        "mt-4": ["base", ["margin-top"]],
      }));
      expect(merge("mt-3 mt-4")).toBe("mt-4");
    } finally {
      jsx.setClassResolver(null);
    }
  });

  it("useClassGroups is additive and the last registration wins per class", () => {
    jsx.useClassGroups({ "mt-1": ["base", ["margin-top"]], "mt-2": ["base", ["margin-top"]] });
    expect(merge("mt-1 mt-2")).toBe("mt-2");
    expect(jsx.classGroup("px-0")).toEqual(["base", ["padding-left", "padding-right"]]);
  });
});
