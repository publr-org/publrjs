import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs, group } from "../../app/walkthrough/content";

export function propsContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, propsLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      "The parent passes name to Greeting through ",
      term(
        "props",
        "Values a parent passes to a child component. Here, Greeting reads the name through props.name.",
      ),
      ".",
    );
    return [
      description,
      fileTabs([
        { name: "PropsDemo.ptsx", card: stateCode("PropsDemo.ptsx", source.trim()) },
        {
          name: "Greeting.ptsx",
          card: stateCode("Greeting.ptsx", propsLesson!.childSource.trim()),
        },
      ]),
    ];
  }
  const setup = stateDOM
    .slice(stateDOM.indexOf("let name"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "");
  const connection =
    stateDOM
      .match(/dom\.component\(Greeting, \{[\s\S]*?\n      \}\)/)![0]
      .replace(/^      /gm, "") + ";";
  if (server) {
    description.parts = [
      "The child’s prop becomes the parent’s name binding. Only the parent needs a store.",
    ];
    const stores = group("props-store-view");
    stores.children.push(
      stateCode(
        "JavaScript · store setup",
        'createLocalStore("PropsDemo", () => ({\n  state: { name: "Ada" },\n  actions: ({ state }) => ({\n    updateName(_data, { event }) {\n      state.name = event.currentTarget.value;\n    }\n  })\n}));',
      ),
    );
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", propsLesson!.html.trim()) },
        { name: "JavaScript · stores", card: stores },
      ]),
    ];
  }
  description.parts = [
    "The child reads props.name. That reads the parent’s current name, so typing updates the greeting.",
  ];
  const binding = stateDOM
    .match(/dom\.attr\(element, "value", [^;]+;/)![0]
    .replace("element,", "input,");
  const event = stateDOM
    .match(/dom\.event\(element, "input", [^;]+;/)![0]
    .replace("element,", "input,");
  const child = propsLesson!.childDOM
    .replaceAll("$$dom", "dom")
    .replaceAll("$$p", "props")
    .match(/dom\.insert\(\(\) => props.name\)/)![0];
  return [
    description,
    fileTabs([
      {
        name: "PropsDemo.js",
        card: stateCode(
          "Generated JavaScript · parent",
          setup + "\n\n" + binding + "\n" + event + "\n\n" + connection,
        ),
      },
      { name: "Greeting.js", card: stateCode("Generated JavaScript · child text", child + ";") },
    ]),
  ];
}
