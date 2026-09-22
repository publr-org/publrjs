import { Window } from "happy-dom";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { demoRoot } from "../paths.mjs";

// Prerender the app's compiled PTSX. Lesson preview HTML still comes from Zig.
// These explicit slots are filled per request, preserving the initial HTTP response.
export async function renderPages(bundle) {
  const window = new Window();
  const globals = [
    "window",
    "document",
    "Node",
    "Element",
    "HTMLElement",
    "DocumentFragment",
    "MutationObserver",
  ];
  const previous = new Map(
    globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  try {
    for (const key of globals)
      Object.defineProperty(globalThis, key, { value: window[key], configurable: true });
    const { pages, mount } = await import(pathToFileURL(bundle).href + `?build=${Date.now()}`);
    const output = resolve(demoRoot, ".generated/pages");
    mkdirSync(output, { recursive: true });
    for (const [name, Component] of Object.entries(pages)) {
      const host = window.document.createElement("div");
      const dispose = mount(host, Component);
      // The page shell is static after prerendering; it is not hydrated in the browser.
      // Flatten compiler fragment hosts so head content remains valid HTML, and remove
      // shell-only region comments. Native lesson output is inserted later, untouched.
      for (const fragment of host.querySelectorAll("p-fragment"))
        fragment.replaceWith(...fragment.childNodes);
      const walker = window.document.createTreeWalker(host, 128);
      const comments = [];
      while (walker.nextNode()) comments.push(walker.currentNode);
      for (const comment of comments) comment.remove();
      const html = host.firstElementChild.outerHTML.replace(
        /__PUBLR_SLOT_([A-Z-]+)__/g,
        "<!--$1-->",
      );
      writeFileSync(resolve(output, `${name}.html`), `<!doctype html>\n${html}\n`);
      dispose();
    }
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await window.happyDOM.close();
  }
}
