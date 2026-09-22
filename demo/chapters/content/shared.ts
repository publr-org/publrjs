import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function sharedContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, sharedLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      "Both targets start with this PTSX. It imports the same ",
      term("shared store", "One instance of count and increment, used by both views."),
      ".",
    );
    return [
      description,
      fileTabs([
        { name: "SharedCounter.ptsx", card: stateCode("SharedCounter.ptsx", source.trim()) },
        {
          name: "shared-counter.ts",
          card: stateCode("shared-counter.ts", sharedLesson!.storeSource.trim()),
        },
      ]),
    ];
  }
  if (server) {
    description.parts.push("Zig renders this HTML and sends it to the browser.");
    return [description, stateCode("Generated HTML", sharedLesson!.html.trim())];
  }
  description.parts.push("PJSX generates these connections to the same imported counter.");
  const display = stateDOM.match(/dom\.insert\(\(\) => counter\.count\)/)?.[0];
  const event = stateDOM.match(/dom\.event\([^;]+;/)?.[0];
  return [
    description,
    stateCode(
      "Generated JavaScript · display + click",
      `${display};\n${event?.replace("element,", "button,")}`,
    ),
  ];
}
