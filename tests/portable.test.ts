import { describe, expect, it } from "vitest";
import {
  PORTABLE_SEMANTICS_VERSION,
  encodePortableScalar,
  decodePortableScalar,
} from "../src/runtime";

describe("portable scalar contract", () => {
  it("preserves undefined, null, signed zero and non-finite values across JSON", () => {
    expect(PORTABLE_SEMANTICS_VERSION).toBe(1);
    for (const value of [
      undefined,
      null,
      true,
      false,
      0,
      -0,
      NaN,
      Infinity,
      -Infinity,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      0.1 + 0.2,
      1e21,
      "",
      "😀é",
      '<&"\n',
    ]) {
      const encoded: unknown = JSON.parse(JSON.stringify(encodePortableScalar(value)));
      expect(Object.is(decodePortableScalar(encoded), value)).toBe(true);
    }
    expect(encodePortableScalar(-0)).toEqual(["number", "8000000000000000"]);
    expect(decodePortableScalar(["number", "3fd3333333333334"])).toBe(0.1 + 0.2);
  });

  it("rejects malformed envelopes instead of coercing or inventing defaults", () => {
    for (const encoded of [
      null,
      0,
      [],
      ["number", 0],
      ["number", "+000000000000000"],
      ["undefined", null],
      ["boolean", 1],
      ["unknown"],
      ["string", "\ud800"],
    ]) {
      expect(() => decodePortableScalar(encoded)).toThrow(TypeError);
    }
    expect(() => encodePortableScalar("\udfff")).toThrow(TypeError);
  });
});
