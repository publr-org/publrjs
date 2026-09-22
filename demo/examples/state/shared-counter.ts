import { createStore } from "publr";

export const counter = createStore("Counter", () => ({
  state: { count: 0 },
  actions: ({ state }) => ({
    increment() {
      state.count++;
    },
  }),
}));
