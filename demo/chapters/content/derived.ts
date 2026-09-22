import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function derivedContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, derivedLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "derived",
        "A value calculated from other values. Publr keeps it up to date when they change.",
      ),
      " keeps doubled equal to count × 2.",
    );
    return [description, stateCode("DerivedCounter.ptsx", source.trim())];
  }
  if (server) {
    description.parts = ["HTML names the values to display. JavaScript keeps them up to date."];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", derivedLesson!.html.trim()) },
        {
          name: "JavaScript · store",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("DerivedCounter", () => ({\n  state: {\n    count: 0,\n    get doubled() { return this.count * 2; }\n  },\n  actions: ({ state }) => ({\n    increment() { state.count++; }\n  })\n}));',
          ),
        },
      ]),
    ];
  }
  description.parts = ["Publr tracks count, recalculates doubled, and updates both outputs."];
  const start = stateDOM.indexOf("let count");
  const end = stateDOM.indexOf("publr.captureActions");
  const values = stateDOM.slice(start, end).trim().replace(/^  /gm, "");
  const displays = [...stateDOM.matchAll(/dom\.insert\(\(\) => (?:count|doubled)\.read\(\)\)/g)]
    .map((match) => match[0] + ";")
    .join("\n");
  const event = stateDOM
    .match(/dom\.event\(element, "click", increment\);/)![0]
    .replace("element,", "button,");
  return [
    description,
    stateCode("Generated JavaScript · values + action", values),
    stateCode("Generated JavaScript · two outputs + click", displays + "\n" + event),
  ];
}
