import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function switchContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, switchLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term("Switch", "Checks its Match conditions in order and shows only the first that is true."),
      " shows the first matching case. Otherwise, it shows the ",
      term("fallback", "The content to show when none of the Match conditions are true."),
      ".",
    );
    return [description, stateCode("StatusMessage.ptsx", source.trim())];
  }
  if (server) {
    description.parts = [
      "Zig renders the Ready case. Publr connects the selector and cases in the browser.",
    ];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", switchLesson!.html.trim()) },
        {
          name: "JavaScript · store",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("Status", () => ({\n  state: { status: "ready" },\n  actions: ({ state }) => ({\n    changeStatus(_data, { event }) {\n      state.status = event.currentTarget.value;\n    }\n  })\n}));',
          ),
        },
      ]),
    ];
  }
  description.parts = [
    "dom.choose checks the cases in order. It replaces the previous message when the selection changes.",
  ];
  const state = stateDOM.match(/let status = [^;]+;/)![0];
  const binding = stateDOM
    .match(/dom\.attr\(element, "value", [^;]+;/)![0]
    .replace("element,", "select,");
  const event = stateDOM
    .match(/dom\.event\(element, "change", [^;]+;/)![0]
    .replace("element,", "select,");
  const choice =
    stateDOM
      .match(/dom\.choose\([\s\S]*?^      \)/m)![0]
      .replace(/^      /gm, "")
      .replace(
        /dom\.element\("p", \(element\) => \{\s*(dom\.append\(element, dom\.literal\("[^"]+"\)\);)\s*\}\)/g,
        'dom.element("p", (element) => { $1 })',
      )
      .replace(
        /dom\.fragment\(\(\) => \[\s*(dom\.element[^\n]+),\s*\]\)/g,
        "dom.fragment(() => [$1])",
      )
      .replace(/make: \(\) =>\s+/g, "make: () => ")
      .replace(/\(\) =>\n\s*dom\.element/g, "() => dom.element") + ";";
  return [
    description,
    stateCode("Generated JavaScript · state + selection", state + "\n" + binding + "\n" + event),
    stateCode("Generated JavaScript · cases + fallback", choice),
  ];
}
