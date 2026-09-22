// The state the end-to-end fixtures read as free variables, shared with the test
// so it can drive them: `ui.label` is mutated to prove a destructured prop with a
// default stays a live binding; `data` seeds the todo list.
import { reactive } from "../../src/publr";

export const ui = reactive({ label: "Clicks" });

export const data = [
  { id: "design", text: "Finish design", done: true },
  { id: "docs", text: "Write docs" },
  { id: "ship", text: "Publish" },
];
