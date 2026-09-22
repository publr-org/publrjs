import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function conditionalContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, conditionalLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "Show",
        "Includes its children when its when value is truthy. Otherwise, it removes them.",
      ),
      " includes the message while visible is true.",
    );
    return [description, stateCode("ConditionalMessage.ptsx", source.trim())];
  }
  if (server) {
    description.parts = ["Zig includes the message because visible starts true."];
    const html = stateCode("Generated HTML", conditionalLesson!.html.trim());
    html.children.push(paragraph("The comments mark where Publr can add or remove the message."));
    const store = stateCode(
      "JavaScript · store setup",
      'createLocalStore("Message", () => ({\n  state: { visible: true },\n  actions: ({ state }) => ({\n    toggle() { state.visible = !state.visible; }\n  })\n}));',
    );
    store.children.push(
      paragraph(
        "Toggle changes visible. The generated Show code adds or removes the marked message.",
      ),
    );
    return [
      description,
      fileTabs([
        { name: "HTML", card: html },
        { name: "JavaScript · store", card: store },
      ]),
    ];
  }
  description.parts = [
    "dom.when watches visible. It creates the message when true and removes it when false.",
  ];
  const values = stateDOM
    .slice(stateDOM.indexOf("let visible"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "");
  const condition =
    stateDOM.match(/dom\.when\([\s\S]*?^      \)/m)![0].replace(/^      /gm, "") + ";";
  const event = stateDOM
    .match(/dom\.event\(element, "click", toggle\);/)![0]
    .replace("element,", "button,");
  return [
    description,
    stateCode("Generated JavaScript · state + action", values),
    stateCode("Generated JavaScript · condition + click", condition + "\n" + event),
  ];
}
