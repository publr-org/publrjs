// The table-driven merge pins the JIT's conflict semantics 1:1 with
// jit/src/class_merge.zig's own tests: same scope + the later class owns every
// property of the earlier one ⇒ the earlier one drops.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TEST_CLASS_GROUPS } from "./helpers";
import * as jsx from "../src/addons/class-merge";
import { mergeClasses, nameOf, namesOf, useClassBook } from "../src/addons/class-merge";

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

describe("class book", () => {
  afterEach(() => useClassBook(null));

  // px-2 / px-4: padding-inline (property 0); p-4: padding (1, covers 0); flex / hidden:
  // display (2); size-4: width (3) and height (4); w-4 shares size-4's width atom.
  const book = {
    classes: [
      ["px-2", "", [0]],
      ["px-4", "", [1]],
      ["p-4", "", [2]],
      ["flex", "", [3]],
      ["hidden", "", [4]],
      ["size-4", "", [5, 6]],
      ["w-4", "", [5]],
      ["w-8", "", [7]],
      ["group/disclosure", "g", []],
    ],
    atoms: [
      ["a", 0, 0],
      ["b", 0, 0],
      ["c", 0, 1],
      ["d", 0, 2],
      ["e", 0, 2],
      ["f", 0, 3],
      ["h", 0, 4],
      ["i", 0, 3],
    ],
    covers: [[1, [0]]],
  } as const;

  it("writes each class as its declarations' names, a later one of a property winning", () => {
    useClassBook(book);
    expect(mergeClasses("flex px-2 px-4")).toBe("d b");
    expect(mergeClasses("size-4 w-8")).toBe("h i");
  });

  it("removes the longhands a later shorthand covers", () => {
    useClassBook(book);
    expect(mergeClasses("px-2 p-4")).toBe("c");
    expect(mergeClasses("p-4 px-2")).toBe("c a");
  });

  it("writes one declaration once, whichever classes hold it", () => {
    useClassBook(book);
    expect(mergeClasses("w-4 size-4")).toBe("f h");
  });

  it("keeps a marker's name and a class it does not hold as they are", () => {
    useClassBook(book);
    expect(mergeClasses("group/disclosure flex hand-made")).toBe("d g hand-made");
  });

  it("reads names as what they stand for", () => {
    useClassBook(book);
    expect(mergeClasses("d b hidden")).toBe("b e");
  });

  it("answers a class's names, or the class without a book", () => {
    expect(namesOf("size-4")).toEqual(["size-4"]);
    useClassBook(book);
    expect(namesOf("size-4")).toEqual(["f", "h"]);
    expect(nameOf("size-4")).toBe("f h");
    expect(namesOf("group/disclosure")).toEqual(["g"]);
    expect(namesOf("hand-made")).toEqual(["hand-made"]);
  });
});
