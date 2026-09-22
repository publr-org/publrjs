import { tick } from "./helpers";
import { expect, it } from "vitest";
import { createLocalStore, destroy, reactive, ref } from "../src/publr";
import { replaceHtml } from "../src/core/lifecycle";
import { createScope, disposeScope, effect, runInScope } from "../src/core/reactivity";

it("child setup cannot subscribe an HTML response to the child's shared dependencies", async () => {
  const scope = createScope();
  const shared = reactive({ revision: 0 });
  const input = reactive({
    html: '<section data-p-store="ResponseChild"><input data-p-ref="field"></section>',
  });
  const host = document.createElement("div");
  document.body.append(host);
  let mounts = 0;
  let renders = 0;
  createLocalStore("ResponseChild", () => ({
    state: {},
    refs: {
      field: ref(() => {
        void shared.revision;
        mounts++;
      }),
    },
  }));
  try {
    runInScope(scope, () =>
      effect(() => {
        renders++;
        replaceHtml(host, input.html);
      }),
    );
    const field = host.querySelector("input")!;
    field.value = "Keep my draft";
    shared.revision++;
    await tick();
    expect(renders).toBe(1);
    expect(mounts).toBe(1);
    expect(host.querySelector("input")).toBe(field);
    expect(field.value).toBe("Keep my draft");
    input.html = "<p>Next response</p>";
    await tick();
    expect(host.textContent).toBe("Next response");
  } finally {
    disposeScope(scope);
    destroy(host);
    host.remove();
  }
});
