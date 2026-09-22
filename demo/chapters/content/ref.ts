import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function refContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, refLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "ref",
        "Holds the actual element in current once Publr connects it. It becomes null when that element is removed.",
      ),
      " gives focusName access to the input.",
    );
    return [description, stateCode("FocusInput.ptsx", source.trim())];
  }
  if (server) {
    description.parts = ["data-p-ref connects the input to nameInput. The button calls focusName."];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", refLesson!.html.trim()) },
        {
          name: "JavaScript · store",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("Focus", () => {\n  const nameInput = ref();\n  return {\n    refs: { nameInput },\n    actions: {\n      focusName() { nameInput.current?.focus(); }\n    }\n  };\n});',
          ),
        },
      ]),
    ];
  }
  description.parts = ["dom.reference connects the input to nameInput. The click calls focusName."];
  const setup = stateDOM
    .slice(stateDOM.indexOf("const nameInput"), stateDOM.indexOf("return dom.element"))
    .trim()
    .replace(/^  /gm, "");
  const reference = stateDOM
    .match(/dom\.reference\(element, nameInput\);/)![0]
    .replace("element,", "input,");
  const event = stateDOM
    .match(/dom\.event\(element, "click", focusName\);/)![0]
    .replace("element,", "button,");
  return [
    description,
    stateCode("Generated JavaScript · reference + callback", setup),
    stateCode("Generated JavaScript · input + click", reference + "\n" + event),
  ];
}
