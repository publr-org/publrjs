import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function inputContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, inputLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "onInput",
        "Runs the callback whenever you edit the input. event.currentTarget.value is its current text.",
      ),
      " saves what you type in name. value puts name back in the input.",
    );
    return [description, stateCode("NameInput.ptsx", source.trim())];
  }
  if (server) {
    description.parts = ["Typing calls updateName. The input and greeting both read name."];
    const store = stateCode(
      "JavaScript · store setup",
      'createLocalStore("Name", () => ({\n  state: { name: "Ada" },\n  actions: ({ state }) => ({\n    updateName(_data, { event }) {\n      state.name = event.currentTarget.value;\n    },\n    reset() { state.name = "Ada"; }\n  })\n}));',
    );
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", inputLesson!.html.trim()) },
        { name: "JavaScript · store", card: store },
      ]),
    ];
  }
  description.parts = ["The input event writes name. Publr updates the input value and greeting."];
  const values = stateDOM
    .slice(stateDOM.indexOf("let name"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "");
  const binding = stateDOM
    .match(/dom\.attr\(element, "value", \(\) => name\.read\(\)\);/)![0]
    .replace("element,", "input,");
  const event = stateDOM
    .match(/dom\.event\(element, "input", [^;]+;/)![0]
    .replace("element,", "input,");
  const display = stateDOM.match(/dom\.insert\(\(\) => name\.read\(\)\)/)![0];
  return [
    description,
    stateCode("Generated JavaScript · state + reset", values),
    stateCode(
      "Generated JavaScript · input + greeting",
      binding + "\n" + event + "\n" + display + ';\ndom.event(button, "click", reset);',
    ),
  ];
}
