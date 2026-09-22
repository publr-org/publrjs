import type { LessonOptions } from "../types";
export function lessonKind(options: LessonOptions): string {
  if (options.portalLesson)
    return options.portalLesson.focus
      ? "focus"
      : options.portalLesson.position
        ? "position"
        : "portals";
  if (options.awaitedLesson)
    return options.awaitedLesson.query
      ? "query"
      : options.awaitedLesson.failure
        ? "failure"
        : "awaited";
  const kinds = [
    ["sharedLesson", "shared-state"],
    ["derivedLesson", "derived"],
    ["effectLesson", "effects"],
    ["conditionalLesson", "conditional"],
    ["listLesson", "lists"],
    ["inputLesson", "inputs"],
    ["switchLesson", "switch"],
    ["refLesson", "refs"],
    ["cleanupLesson", "cleanup"],
    ["propsLesson", "props"],
    ["compositionLesson", "composition"],
    ["reuseLesson", "reuse"],
  ] as const;
  for (const [key, kind] of kinds) if (options[key]) return kind;
  return options.stateLesson ? "state" : options.renderOnly ? "introduction" : "interaction";
}
export const walkthroughCopy: Record<
  string,
  { loaded: string[]; ready: string[]; demoTitle: string }
> = {
  introduction: {
    loaded: [
      "The greeting loaded with the initial HTML. It's ready.",
      "An empty app arrives. There is no greeting yet.",
    ],
    ready: [
      "The greeting is already here. No JavaScript needed to render it.",
      "JavaScript created the heading. The greeting is ready.",
    ],
    demoTitle: "From page load to greeting.",
  },
  interaction: {
    loaded: [
      "The button loaded with the initial HTML. No click attached yet.",
      "An empty app arrives. There is no button yet.",
    ],
    ready: [
      "Button now has onClick event attached. It's hydrated. Click it.",
      "Button now has onClick event attached. It's hydrated. Click it.",
    ],
    demoTitle: "From page load to click.",
  },
  state: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. There is no counter yet.",
    ],
    ready: [
      "Click Increment. It changes count; the displayed number updates.",
      "Click Increment. It changes count; the displayed number updates.",
    ],
    demoTitle: "From page load to click.",
  },
  "shared-state": {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. There is no counter yet.",
    ],
    ready: [
      "Click either Increment. Both views read and update the same count.",
      "Click either Increment. Both views read and update the same count.",
    ],
    demoTitle: "From page load to shared count.",
  },
  derived: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. There is no counter yet.",
    ],
    ready: [
      "Click Increment. Doubled updates from count × 2.",
      "Click Increment. Doubled updates from count × 2.",
    ],
    demoTitle: "From page load to click.",
  },
  effects: {
    loaded: [
      "The counter arrived as HTML. The effect has not run yet.",
      "An empty app arrives. The effect has not run yet.",
    ],
    ready: [
      "The effect ran once. Click Increment to update the tab title again.",
      "The effect ran once. Click Increment to update the tab title again.",
    ],
    demoTitle: "From page load to click.",
  },
  conditional: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No button or message yet.",
    ],
    ready: [
      "Click Toggle message. Publr removes the message, then creates it again.",
      "Click Toggle message. Publr removes the message, then creates it again.",
    ],
    demoTitle: "From page load to click.",
  },
  lists: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No buttons or rows yet.",
    ],
    ready: [
      "Add or remove an item. Publr updates its row and keeps the others.",
      "Add or remove an item. Publr updates its row and keeps the others.",
    ],
    demoTitle: "From page load to click.",
  },
  inputs: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No input or greeting yet.",
    ],
    ready: [
      "Type a name, then reset it. The input and greeting update together.",
      "Type a name, then reset it. The input and greeting update together.",
    ],
    demoTitle: "From page load to typing.",
  },
  switch: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No selector or message yet.",
    ],
    ready: [
      "Choose a status. Publr replaces the message with the matching case.",
      "Choose a status. Publr replaces the message with the matching case.",
    ],
    demoTitle: "From page load to selection.",
  },
  refs: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No input or button yet.",
    ],
    ready: [
      "Click Focus input. nameInput.current points to this input.",
      "Click Focus input. nameInput.current points to this input.",
    ],
    demoTitle: "From page load to focus.",
  },
  cleanup: {
    loaded: [
      "The page arrived as HTML. The timer has not started yet.",
      "An empty app arrives. The timer has not started yet.",
    ],
    ready: [
      "Remove the timer to run its cleanup. Show it again to start a new timer.",
      "Remove the timer to run its cleanup. Show it again to start a new timer.",
    ],
    demoTitle: "From page load to cleanup.",
  },
  props: {
    loaded: [
      "The page arrived as HTML. Ready to hydrate.",
      "An empty app arrives. No input or greeting yet.",
    ],
    ready: [
      "Type a name. The parent passes the new value to Greeting.",
      "Type a name. The parent passes the new value to Greeting.",
    ],
    demoTitle: "From page load to child update.",
  },
  composition: {
    loaded: [
      "The greeting loaded with the initial HTML. It's ready.",
      "An empty app arrives. There is no greeting yet.",
    ],
    ready: [
      "The greeting is already rendered. No browser store is needed.",
      "JavaScript rendered the greeting. No browser store is needed.",
    ],
    demoTitle: "From page load to greeting.",
  },
  reuse: {
    loaded: [
      "Both counts arrived as HTML. The buttons are not connected yet.",
      "An empty app arrives. No counters yet.",
    ],
    ready: [
      "Increment either counter. Only its own count changes.",
      "Increment either counter. Only its own count changes.",
    ],
    demoTitle: "From page load to independent counts.",
  },
  awaited: {
    loaded: [
      "The server resolved people before sending this HTML. No browser request yet.",
      "Only an app placeholder arrives. The browser has not requested people yet.",
    ],
    ready: [
      "Search for Ada. The previous people stay while the response is paused. Click Respond now to finish.",
      "Click Respond now to load the first people. Then search for Ada and release the next response.",
    ],
    demoTitle: "From page load to a new result.",
  },
  failure: {
    loaded: [
      "The server resolved people before sending this HTML. No browser request yet.",
      "Only an app placeholder arrives. The browser has not requested people yet.",
    ],
    ready: [
      "Fail the next search, release its response, then Retry. Turn off Pause response to try a slow search followed by a newer one.",
      "Respond now loads the first list. Then fail a search and Retry. Turn off Pause response to try overlapping searches.",
    ],
    demoTitle: "From page load to failure and retry.",
  },
  query: {
    loaded: [
      "The server resolved people before sending this HTML. No browser request yet.",
      "Only an app placeholder arrives. The browser has not requested people yet.",
    ],
    ready: [
      "Choose Ada, then Respond now. Return to All people: a fresh result needs no request. Add a person, then Respond now to see the new row in both readers.",
      "Respond now loads both readers. Then try Ada → Respond now → All people. Add a person, then respond once to update both readers.",
    ],
    demoTitle: "From page load to shared requests.",
  },
  portals: {
    loaded: [
      "Ada’s card arrived as HTML. The panel is hidden inside its container; actions are not connected yet.",
      "Only an app placeholder arrives. No card or panel yet.",
    ],
    ready: [
      "Open details. The panel is outside the dashed container. Thank Ada to update the count, then close the panel.",
      "Open details. The panel is outside the dashed container. Thank Ada to update the count, then close the panel.",
    ],
    demoTitle: "From page load to an escaped panel.",
  },
  position: {
    loaded: [
      "Ada’s card arrived as HTML. The panel is hidden inside its container; actions are not connected yet.",
      "Only an app placeholder arrives. No card or panel yet.",
    ],
    ready: [
      "Open details. Move the trigger to Bottom to flip above, or Right edge to change alignment. Scroll the scene to watch the panel follow.",
      "Open details. Move the trigger to Bottom to flip above, or Right edge to change alignment. Scroll the scene to watch the panel follow.",
    ],
    demoTitle: "From page load to an anchored panel.",
  },
  focus: {
    loaded: [
      "Ada’s card arrived as HTML. The panel is hidden inside its container; actions are not connected yet.",
      "Only an app placeholder arrives. No card or panel yet.",
    ],
    ready: [
      "Open details, then try Tab and Shift+Tab. Escape closes the dialog and restores the previously focused element.",
      "Open details, then try Tab and Shift+Tab. Escape closes the dialog and restores the previously focused element.",
    ],
    demoTitle: "From page load to focus and return.",
  },
};
