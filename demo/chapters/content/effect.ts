import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function effectContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, effectLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "effect",
        "Code that runs once in the browser, then again when a value it reads changes.",
      ),
      " keeps the tab title in sync with count.",
    );
    return [description, stateCode("EffectCounter.ptsx", source.trim())];
  }
  if (server) {
    description.parts = [
      "Zig renders the counter. In the browser, Publr connects its store and starts the effect.",
    ];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", effectLesson!.html.trim()) },
        {
          name: "JavaScript · store",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("EffectCounter", ({ state }) => ({\n  state: { count: 0 },\n  actions: {\n    increment() { state.count++; }\n  },\n  init() {\n    effect(() => {\n      document.title = "Count: " + state.count;\n    });\n  }\n}));',
          ),
        },
      ]),
    ];
  }
  description.parts = [
    "JavaScript creates the counter and starts the effect. Reading count connects it to later changes.",
  ];
  const values = stateDOM
    .slice(stateDOM.indexOf("let count"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "");
  const display = stateDOM.match(/dom\.insert\(\(\) => count\.read\(\)\)/)![0];
  const event = stateDOM
    .match(/dom\.event\(element, "click", increment\);/)![0]
    .replace("element,", "button,");
  return [
    description,
    stateCode("Generated JavaScript · state + effect", values),
    stateCode("Generated JavaScript · output + click", display + ";\n" + event),
  ];
}
