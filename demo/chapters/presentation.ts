import { lessonKind, walkthroughCopy } from "./content/copy";
import type { LessonOptions } from "./types";
import {
  codeCard,
  paragraph,
  inlineCode,
  term,
  type Snippet,
  type Content,
  type ContentContext,
} from "../app/walkthrough/content";
import { stateContent } from "./content/state";
import { stateTitle } from "./content/state-title";
import { sharedContent } from "./content/shared";
import { compositionContent } from "./content/composition";

export function lessonPresentation(options: LessonOptions) {
  const copy = walkthroughCopy[lessonKind(options)];
  const {
    source,
    domSource,
    companion = "",
    renderOnly = false,
    stateLesson = false,
    awaitedLesson,
    portalLesson,
    reuseLesson,
    compositionLesson,
    propsLesson,
    cleanupLesson,
    refLesson,
    switchLesson,
    inputLesson,
    listLesson,
    conditionalLesson,
    effectLesson,
    derivedLesson,
    sharedLesson,
  } = options;

  const previewURL = `/learn/${lessonKind(options)}/preview`;
  const sourceName = renderOnly ? "TemplateGreeting.ptsx" : "Hello.ptsx";
  const highlight = renderOnly ? "Hello." : "openAlert";
  // The snippet comes from the generated JavaScript used by this demo.
  const callback = companion.match(/const openAlert = [^\n]+/)?.[0] ?? "";
  // Keep the compiler's actual calls; only rename its temporary variables and format them.
  const generatedDOM = domSource
    .replaceAll("$$domElement", renderOnly ? "heading" : "button")
    .replaceAll("$$dom", "dom")
    .replace("=> { ", "=> {\n    ")
    .replaceAll("; dom.", ";\n    dom.")
    .replace("; });", ";\n  });")
    .trim();
  const stateDOM = domSource
    .replaceAll("$$domProps0", "item")
    .replaceAll("$$domElement", "element")
    .replaceAll("$$dom", "dom")
    .replaceAll("$$publrDOM", "dom")
    .replaceAll("$$publr", "publr")
    .replaceAll("$$value", "value")
    .replaceAll("$$result", "result")
    .replace(/"(count|doubled|visible|items|name|status)@\d+"/g, '"$1"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const loadedCopy = (server: boolean) => copy.loaded[server ? 0 : 1];
  const readyCopy = (server: boolean) => copy.ready[server ? 0 : 1];
  const stateCode = (label: string, text: string) => {
    const card = codeCard(
      label,
      text,
      portalLesson
        ? "showDetails"
        : awaitedLesson
          ? "updateSearch"
          : reuseLesson
            ? "increment"
            : propsLesson
              ? "updateName"
              : cleanupLesson
                ? "toggle"
                : refLesson
                  ? "focusName"
                  : switchLesson
                    ? "changeStatus"
                    : inputLesson
                      ? "reset"
                      : listLesson
                        ? "add"
                        : conditionalLesson
                          ? "toggle"
                          : "increment",
      portalLesson
        ? portalLesson.focus
          ? "FocusDetails"
          : portalLesson.position
            ? "AnchoredDetails"
            : "PersonDetails"
        : awaitedLesson
          ? awaitedLesson.query
            ? "SharedPeople"
            : awaitedLesson.failure
              ? "ResilientSearch"
              : "PeopleSearch"
          : reuseLesson
            ? "InstanceCounter"
            : propsLesson
              ? text.includes("PropsDemo")
                ? "PropsDemo"
                : "Greeting"
              : cleanupLesson
                ? text.includes('"TimerDemo"')
                  ? "TimerDemo"
                  : "Timer"
                : refLesson
                  ? "Focus"
                  : switchLesson
                    ? "Status"
                    : inputLesson
                      ? "Name"
                      : listLesson
                        ? "List"
                        : conditionalLesson
                          ? "Message"
                          : effectLesson
                            ? "EffectCounter"
                            : derivedLesson
                              ? "DerivedCounter"
                              : "Counter",
    );
    return { ...card, annotation: { ...card.annotation, state: true, shared: !!sharedLesson } };
  };
  const ctx: ContentContext = { ...options, stateDOM, stateCode };
  function title(index: number, server: boolean) {
    if (index === 2) return "Page loaded.";
    if (index === 3)
      return awaitedLesson
        ? server
          ? "Search is connected."
          : "First request."
        : renderOnly
          ? server
            ? "Already rendered."
            : "Render. Ready."
          : server
            ? sharedLesson
              ? "Connect. Ready."
              : "Hydrate. Ready."
            : sharedLesson
              ? "Render + connect. Ready."
              : "Render + hydrate. Ready.";
    if (compositionLesson)
      return index === 0
        ? "Two components."
        : server
          ? "One HTML result."
          : "Render in the browser.";
    if (sharedLesson)
      return index === 0
        ? "Your PTSX."
        : server
          ? "Zig generates HTML."
          : "JavaScript creates the counter.";
    if (stateLesson) return stateTitle(ctx, index === 0, server);
    return index === 0
      ? "Your PTSX."
      : server
        ? renderOnly
          ? "HTML."
          : "HTML + JavaScript."
        : renderOnly
          ? "JavaScript creates the heading."
          : "JavaScript creates the button.";
  }
  function content(index: number, server: boolean): Content[] {
    if (compositionLesson) return compositionContent(ctx, index, server);
    if (sharedLesson) return sharedContent(ctx, index, server);
    if (stateLesson) return stateContent(ctx, index, server);
    if (renderOnly)
      return [
        paragraph(
          index === 0
            ? "PTSX defines a heading with Hello. inside."
            : server
              ? "Zig renders the heading as HTML."
              : "JavaScript creates the heading in the browser.",
        ),
        codeCard(
          index === 0 ? sourceName : server ? "HTML" : "Generated JavaScript",
          index === 0 ? source.trim() : server ? "<h1>Hello.</h1>" : generatedDOM,
          highlight,
        ),
      ];
    if (index === 0)
      return [
        paragraph(
          "PTSX defines the click ",
          term(
            "callback",
            "Code that waits until something happens. Here, it runs when you click the button.",
          ),
          " in ",
          inlineCode("onClick"),
          ".",
        ),
        codeCard("Hello.ptsx", source.trim(), "openAlert"),
      ];
    if (server) {
      const action = callback.replace("const openAlert = ", "openAlert: ").replace(/;$/, "");
      return [
        codeCard(
          "HTML",
          '<button data-p-store="Hello"\n        data-p-on="click:openAlert">\n  Say hello\n</button>',
          "openAlert",
          "Hello",
        ),
        codeCard(
          "JavaScript · store setup",
          `createLocalStore("Hello", () => ({\n  actions: {\n    ${action}\n  }\n}));`,
          "openAlert",
          "Hello",
        ),
      ];
    }
    return [
      paragraph("You write onClick; PJSX generates the connection below."),
      codeCard("Generated JavaScript", generatedDOM, "openAlert"),
    ];
  }
  const demoTitle = copy.demoTitle;
  return {
    demoTitle,
    title,
    content,
    loadedCopy,
    readyCopy,
    previewURL,
    stateCode,
    previewCode: (text: string) =>
      stateLesson || sharedLesson
        ? stateCode("HTML", text)
        : codeCard("HTML", text, highlight, "Hello"),
  };
}
export type LessonPresentation = {
  demoTitle: string;
  title: (index: number, server: boolean) => string;
  content: (index: number, server: boolean) => Content[];
  loadedCopy: (server: boolean) => string;
  readyCopy: (server: boolean) => string;
  previewURL: string;
  stateCode: (label: string, text: string) => Snippet;
  previewCode: (text: string) => Snippet;
};
