import { expect, it } from "vitest";
import { tokenize, snippetLanguage } from "../demo/app/code/tokenize";

it("preserves exact TSX text and action annotations across syntax tokens", () => {
  const source =
    "const button = ref<HTMLButtonElement>();\nreturn <button onClick={save}>Save & go</button>;";
  const parts = tokenize(source, "tsx", { action: "save" });
  expect(parts.map((part) => part.text).join("")).toBe(source);
  expect(
    parts
      .filter((part) => part.mark !== null)
      .map((part) => part.text)
      .join(""),
  ).toBe("save");
  for (const syntax of ["keyword", "tag", "attr-name"])
    expect(parts.some((part) => part.syntax.includes(syntax))).toBe(true);
  expect(tokenize(source, "tsx", { action: "save" })).toEqual(parts);
});

it("uses whole-source syntax context across annotation boundaries", () => {
  const source = '// const is a comment\nconst text = "return <script>";';
  const parts = tokenize(source, "javascript", { action: "const" });
  expect(parts.map((part) => part.text).join("")).toBe(source);
  expect(parts.find((part) => part.mark !== null)?.syntax).toBe("comment");
  expect(snippetLanguage("data.ts")).toBe("typescript");
  expect(snippetLanguage("Demo.ptsx")).toBe("tsx");
  expect(snippetLanguage("Generated JavaScript")).toBe("javascript");
});
