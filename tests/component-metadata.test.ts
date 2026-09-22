import { expect, it } from "vitest";
import { structuralRootEnd } from "../src/core/component-metadata";

it("matches nested and adjacent structural ranges without instance identifiers", () => {
  const host = document.createElement("div");
  host.innerHTML = `<template data-p-root-start></template><template data-p-root-start></template><span>nested</span><template data-p-root-end></template><template data-p-root-end></template><template data-p-root-start></template><template data-p-root-end></template><span>unrelated</span>`;
  const starts = host.querySelectorAll("[data-p-root-start]");
  const ends = host.querySelectorAll("[data-p-root-end]");
  expect(structuralRootEnd(starts[0])).toBe(ends[1]);
  expect(structuralRootEnd(starts[1])).toBe(ends[0]);
  expect(structuralRootEnd(starts[2])).toBe(ends[2]);
  ends[1].remove();
  expect(() => structuralRootEnd(starts[0])).toThrow("missing structural root");
});
