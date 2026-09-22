// @ts-expect-error Generated PTSX module.
import { TimerDemo } from "../../.generated/components/TimerDemo.js";
import source from "../../examples/components/TimerDemo.ptsx?raw";
import domSource from "../../.generated/components/TimerDemo.js?raw";
import html from "../../.generated/components/TimerDemo.html?raw";
import timerSource from "../../examples/components/Timer.ptsx?raw";
import timerDOM from "../../.generated/components/Timer.js?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/TimerDemo.behavior.js";

setupWalkthrough({
  Component: TimerDemo,
  source,
  domSource,
  stateLesson: true,
  cleanupLesson: { html, timerSource, timerDOM },
});
