import type { ContentContext } from "../../app/walkthrough/content";
import { fileTabs } from "../../app/walkthrough/content";

export function cleanupSource(ctx: ContentContext) {
  const { source, cleanupLesson } = ctx;
  const stateCode = ctx.stateCode;
  return fileTabs([
    { name: "TimerDemo.ptsx", card: stateCode("TimerDemo.ptsx", source.trim()) },
    { name: "Timer.ptsx", card: stateCode("Timer.ptsx", cleanupLesson!.timerSource.trim()) },
  ]);
}
