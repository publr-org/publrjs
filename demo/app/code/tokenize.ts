import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import type { Annotation } from "../walkthrough/content";
export function snippetLanguage(label: string): string {
  if (/\.(?:ptsx|tsx|jsx)\b|PTSX|JSX/i.test(label)) return "tsx";
  if (/\.ts\b|TypeScript/i.test(label)) return "typescript";
  if (/HTML/i.test(label)) return "markup";
  if (/\.zig\b/i.test(label)) return "none";
  return "javascript";
}
Prism.manual = true;
export type Segment = { text: string; syntax: string; mark: string | null };
const actions = new Set(
  "showAll showAda showDetails closeDetails thankAda trapFocus portal position add addPerson savePerson invalidate retry refresh remove updateName onInput".split(
    " ",
  ),
);
const derived = new Set(
  "doubled effect document.title Show when For forEach key Switch Match choose fallback ref reference setInterval clearInterval props Greeting".split(
    " ",
  ),
);
const values =
  "trigger panel anchor open thanks mutation cache ttl tags readPeople isError awaited Loading people search findPeople count visible items name status nameInput ticks".split(
    " ",
  );
const stateWords = new Set([...actions, ...derived, ...values, "PeopleReader"]);
export function tokenize(source: string, language: string, annotation: Annotation = {}): Segment[] {
  const grammar = Prism.languages[language];
  const env = { code: source, grammar, language, tokens: [] as Prism.TokenStream };
  if (grammar) {
    Prism.hooks.run("before-tokenize", env);
    env.tokens = Prism.tokenize(env.code, env.grammar);
    Prism.hooks.run("after-tokenize", env);
  } else env.tokens = source;
  const syntax: { start: number; end: number; classes: string }[] = [];
  let offset = 0;
  const flatten = (tokens: Prism.TokenStream, classes = "") => {
    if (typeof tokens === "string") {
      if (tokens.length) syntax.push({ start: offset, end: offset + tokens.length, classes });
      offset += tokens.length;
    } else if (Array.isArray(tokens)) tokens.forEach((token) => flatten(token, classes));
    else flatten(tokens.content, [tokens.type, ...[tokens.alias ?? []].flat()].join(" "));
  };
  flatten(env.tokens);
  const marks: { start: number; end: number; className: string }[] = [];
  if (annotation.action)
    for (const match of source.matchAll(
      new RegExp(annotation.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    ))
      marks.push({ start: match.index, end: match.index + match[0].length, className: "" });
  if (annotation.store)
    for (const match of source.matchAll(new RegExp('"' + annotation.store + '"', "g")))
      marks.push({
        start: match.index + 1,
        end: match.index + match[0].length - 1,
        className: "store-highlight",
      });
  if (annotation.state)
    for (const match of source.matchAll(/\bdocument\.title\b|\b\w+\b/g)) {
      const word = match[0];
      if (annotation.shared ? word !== "count" && word !== "counter" : !stateWords.has(word))
        continue;
      if (marks.some((mark) => match.index >= mark.start && match.index < mark.end)) continue;
      marks.push({
        start: match.index,
        end: match.index + word.length,
        className: actions.has(word)
          ? ""
          : word === "counter" || word === "PeopleReader"
            ? "store-highlight"
            : derived.has(word)
              ? "derived-highlight"
              : "value-highlight",
      });
    }
  const segments: Segment[] = [];
  for (const range of syntax) {
    const cuts = [
      ...new Set([
        range.start,
        range.end,
        ...marks
          .flatMap((mark) => [mark.start, mark.end])
          .filter((at) => at > range.start && at < range.end),
      ]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++)
      segments.push({
        text: source.slice(cuts[i], cuts[i + 1]),
        syntax: range.classes,
        mark: marks.find((mark) => cuts[i] >= mark.start && cuts[i] < mark.end)?.className ?? null,
      });
  }
  return segments;
}
