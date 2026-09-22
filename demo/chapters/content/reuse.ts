import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function reuseContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, domSource, reuseLesson } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      "ReuseDemo creates two ",
      term("instances", "Separate uses of the same component. Each call creates its own count."),
      ". The initial prop starts one at 0 and the other at 10.",
    );
    return [
      description,
      fileTabs([
        { name: "ReuseDemo.ptsx", card: stateCode("ReuseDemo.ptsx", source.trim()) },
        {
          name: "InstanceCounter.ptsx",
          card: stateCode("InstanceCounter.ptsx", reuseLesson!.childSource.trim()),
        },
      ]),
    ];
  }
  if (server) {
    description.parts = [
      "Only the counters need local stores. Publr adopts each output’s initial text as count. The numeric default makes “10” become the number 10.",
    ];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", reuseLesson!.html.trim()) },
        {
          name: "stores.js",
          card: stateCode(
            "JavaScript · equivalent public setup",
            `import { createLocalStore } from "publr";

createLocalStore("InstanceCounter", () => ({
  state: { count: 0 },
  actions: ({ state }) => ({
    increment() { state.count++; }
  })
}));`,
          ),
        },
      ]),
    ];
  }
  description.parts = [
    "The parent calls InstanceCounter twice. Each call creates its own count. Below, the generated DOM operations use an equivalent public reactive object for state.",
  ];
  const readable = (text: string) =>
    text
      .replaceAll("$$domProps0", "props")
      .replaceAll("$$domElement", "element")
      .replaceAll("$$dom", "dom")
      .replaceAll("$$publr", "publr")
      .trim();
  const child = readable(reuseLesson!.childDOM)
    .replace('import * as publr from "publr/runtime";', 'import { reactive } from "publr";')
    .replace(/let count = [^;]+;/, "const counter = reactive({ count: props.initial });")
    .replace(/count\.update\(\([\s\S]*?\n    \}\);/, "counter.count++;")
    .replace(/\s*publr\.captureActions\([^;]+;/, "")
    .replaceAll("count.read()", "counter.count");
  return [
    description,
    fileTabs([
      { name: "ReuseDemo.js", card: stateCode("Generated JavaScript", readable(domSource)) },
      {
        name: "InstanceCounter.js",
        card: stateCode("JavaScript · public state + generated DOM", child),
      },
    ]),
  ];
}
