import { afterEach, expect, it } from "vitest";
import { loadRuntime, tick, type Runtime } from "./helpers";

let runtime: Runtime;
afterEach(() => {
  runtime?.destroy(document.body);
  document.body.innerHTML = "";
});

it("updates a composed greeting using only standalone HTML and the public parent store", async () => {
  runtime = await loadRuntime();
  runtime.createLocalStore("PropsDemo", () => ({
    state: { name: "Ada" },
    actions: ({ state }) => ({
      updateName(_data: unknown, { event }: { event: Event }) {
        state.name = (event.currentTarget as HTMLInputElement).value;
      },
    }),
  }));
  document.body.innerHTML =
    '<div data-p-store="PropsDemo"><input data-p-on="input:updateName" data-p-bind="value:$name" value="Ada"><p>Hello, <output data-p-text="$name">Ada</output>!</p></div>';
  const output = document.querySelector("output")!;
  runtime.hydrate(document);
  const input = document.querySelector("input")!;
  input.value = "Grace";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  expect(document.querySelector("output")).toBe(output);
  expect(output.textContent).toBe("Grace");
  expect(document.querySelectorAll("[data-p-store]")).toHaveLength(1);
});
