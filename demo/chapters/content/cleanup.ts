import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";
import { cleanupSource } from "./cleanup-source";

export function cleanupContent(ctx: ContentContext, index: number, server: boolean) {
  const { cleanupLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      "Show removes Timer. Its effect returns a ",
      term(
        "cleanup",
        "A function Publr runs when the effect is disposed. Here it stops the interval when Timer is removed.",
      ),
      " that stops the interval.",
    );
    return [description, cleanupSource(ctx)];
  }
  if (server) {
    description.parts = [
      "Zig renders zero ticks. The browser starts the timer and owns its cleanup.",
    ];
    return [
      description,
      fileTabs([
        { name: "HTML", card: stateCode("Generated HTML", cleanupLesson!.html.trim()) },
        {
          name: "TimerDemo.js",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("TimerDemo", () => ({\n  state: { visible: true },\n  actions: ({ state }) => ({\n    toggle() { state.visible = !state.visible; }\n  })\n}));',
          ),
        },
        {
          name: "Timer.js",
          card: stateCode(
            "JavaScript · store setup",
            'createLocalStore("Timer", ({ state }) => ({\n  state: { ticks: 0 },\n  init() {\n    effect(() => {\n      const timer = window.setInterval(() => state.ticks++, 1000);\n      return () => window.clearInterval(timer);\n    });\n  }\n}));',
          ),
        },
      ]),
    ];
  }
  description.parts = ["The generated Show code owns Timer. Removing it also disposes its effect."];
  const parent = stateDOM
    .slice(stateDOM.indexOf("let visible"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "");
  const child = stateDOM.match(/dom\.when\([\s\S]*?^      \)/m)![0].replace(/^      /gm, "") + ";";
  const timer = cleanupLesson!.timerDOM
    .replaceAll("$$publr", "publr")
    .replaceAll("$$dom", "dom")
    .replaceAll("$$value", "value")
    .replaceAll("$$result", "result")
    .replace(/"ticks@\d+"/g, '"ticks"');
  const timerCode = timer
    .slice(timer.indexOf("let ticks"), timer.indexOf("return dom.element"))
    .trim()
    .replace(/^  /gm, "");
  return [
    description,
    fileTabs([
      {
        name: "TimerDemo.js",
        card: stateCode(
          "Generated JavaScript · parent",
          parent + "\n" + child + '\ndom.event(button, "click", toggle);',
        ),
      },
      {
        name: "Timer.js",
        card: stateCode(
          "Generated JavaScript · timer",
          timerCode + "\ndom.insert(() => ticks.read());",
        ),
      },
    ]),
  ];
}
