import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, codeCard, fileTabs } from "../../app/walkthrough/content";

export function compositionContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, domSource, compositionLesson } = ctx;
  const description = paragraph();
  if (index === 0) {
    description.parts.push("StaticPage uses StaticGreeting and passes the name Ada.");
    return [
      description,
      fileTabs([
        { name: "StaticPage.ptsx", card: codeCard("StaticPage.ptsx", source.trim(), "Ada") },
        {
          name: "StaticGreeting.ptsx",
          card: codeCard(
            "StaticGreeting.ptsx",
            compositionLesson!.childSource.trim(),
            "props.name",
          ),
        },
      ]),
    ];
  }
  if (server) {
    description.parts = [
      "The server calls both components and sends their HTML. No JavaScript store is needed.",
    ];
    return [
      description,
      codeCard(
        "HTML",
        compositionLesson!.html.trim().replace("<p>", "\n  <p>").replace("</p>", "</p>\n"),
        "Ada",
      ),
    ];
  }
  description.parts = [
    "JavaScript calls the components in the browser. No state or store is needed.",
  ];
  const readable = (text: string) =>
    text
      .replaceAll("$$domElement", "element")
      .replaceAll("$$dom", "dom")
      .replaceAll("$$p", "props")
      .trim();
  return [
    description,
    fileTabs([
      {
        name: "StaticPage.js",
        card: codeCard("Generated JavaScript", readable(domSource), "Ada"),
      },
      {
        name: "StaticGreeting.js",
        card: codeCard("Generated JavaScript", readable(compositionLesson!.childDOM), "props.name"),
      },
    ]),
  ];
}
