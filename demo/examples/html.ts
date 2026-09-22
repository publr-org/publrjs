import { createLocalStore } from "publr";

createLocalStore("htmlCounter", () => ({
  state: { count: 0 },
  actions: ({ state }) => ({
    increment() {
      state.count++;
    },
  }),
}));

// Markup: examples/counter.html. No PTSX component is used here.
export function start(_host: HTMLElement) {
  return "HTML bindings attached. Increment now calls the store action.";
}
