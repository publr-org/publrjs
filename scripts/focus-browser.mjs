import assert from "node:assert/strict";
import { resolve } from "node:path";
import { build } from "vite-plus";
import { chromium, firefox, webkit } from "../../pjsx/node_modules/playwright/index.mjs";

const result = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: false,
    lib: { entry: resolve("src/addons/focus.ts"), name: "Focus", formats: ["iife"] },
  },
});
const code = (Array.isArray(result) ? result[0] : result).output.find(
  (item) => item.type === "chunk",
).code;
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<input id="previous"><div id="panel"><button>First</button><button>Last</button></div><div id="target"></div>',
    );
    await page.addScriptTag({ content: code });
    const results = await page.evaluate(() => {
      const previous = document.querySelector("#previous");
      const panel = document.querySelector("#panel");
      const results = {};
      for (const kind of [
        "default",
        "button",
        "negative-tabindex",
        "editable",
        "plain",
        "disabled",
        "hidden",
        "css-hidden",
        "inert",
        "detached",
      ]) {
        const target = document.createElement(
          kind === "plain" || kind === "negative-tabindex" || kind === "editable"
            ? "div"
            : "button",
        );
        target.textContent = "Override";
        if (kind === "negative-tabindex") target.tabIndex = -1;
        if (kind === "editable") target.contentEditable = "true";
        document.body.append(target);
        previous.focus();
        const release = Focus.trapFocus(
          panel,
          kind === "default" ? {} : { restoreFocusEl: target },
        );
        if (kind === "disabled") target.disabled = true;
        if (kind === "hidden") target.hidden = true;
        if (kind === "css-hidden") target.style.display = "none";
        if (kind === "inert") target.inert = true;
        if (kind === "detached") target.remove();
        panel.lastElementChild.focus();
        release();
        const expected = ["button", "negative-tabindex", "editable"].includes(kind)
          ? target
          : previous;
        results[kind] = document.activeElement === expected;
        target.remove();
      }
      previous.focus();
      const release = Focus.trapFocus(panel, { initialFocusEl: panel.lastElementChild });
      results.initial = document.activeElement === panel.lastElementChild;
      release();
      results.initialRestoresPrevious = document.activeElement === previous;
      return results;
    });
    for (const [kind, passed] of Object.entries(results)) assert(passed, `${name}: ${kind}`);
    console.log(
      `${name}: default restoration, initial override, valid restoration overrides and unfocusable fallback passed.`,
    );
  } finally {
    await browser.close();
  }
}
