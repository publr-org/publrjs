import type { LessonOptions } from "../../chapters/types";

export type Inline =
  | string
  | { kind: "term"; text: string; definition: string }
  | { kind: "code"; text: string };
export type Annotation = { action?: string; store?: string; state?: boolean; shared?: boolean };
export type Paragraph = { kind: "paragraph"; parts: Inline[] };
export type Snippet = {
  kind: "snippet";
  description?: string;
  label: string;
  source: string;
  generated: boolean;
  annotation: Annotation;
  children: Paragraph[];
};
export type Group = { kind: "group"; className: string; children: Snippet[] };
export type Files = { kind: "files"; files: { name: string; card: Snippet | Group }[] };
export type Content = Paragraph | Snippet | Group | Files;
export type ContentContext = LessonOptions & {
  stateDOM: string;
  stateCode: (label: string, text: string) => Snippet;
};

export const paragraph = (...parts: Inline[]): Paragraph => ({ kind: "paragraph", parts });
export const inlineCode = (text: string): Inline => ({ kind: "code", text });
export const term = (text: string, definition: string): Inline => ({
  kind: "term",
  text,
  definition,
});
export const group = (className: string): Group => ({ kind: "group", className, children: [] });
export const codeCard = (label: string, source: string, action = "", store?: string): Snippet => ({
  kind: "snippet",
  label,
  source,
  generated: /^(Generated|HTML|JavaScript)/.test(label),
  annotation: { action, store },
  children: [],
});
export const fileTabs = (files: { name: string; card: Snippet | Group }[]): Files => ({
  kind: "files",
  files,
});
