import { demoFile } from "../paths.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true });
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/learn/focus`);
  const source = page.locator('.source code[data-syntax="tsx"]');
  await source.waitFor();
  assert.equal(
    (await source.textContent()).trim(),
    (await readFile(demoFile("FocusDetails.ptsx"), "utf8")).trim(),
  );
  assert(await source.locator(".keyword").count());
  assert(await source.locator(".tag").count());
  assert(await source.locator(".string").count());
  await page.screenshot({ path: "/tmp/publr-highlighting-source.png", fullPage: true });
  await page.locator('[data-walkthrough="zig"]').click();
  const marked = page.locator("#walkthrough-scene code").first();
  assert(await marked.locator("mark").count());
  assert.equal((await marked.textContent()).trim(), (await source.textContent()).trim());
  async function annotations(dialog = "#walkthrough") {
    assert(await page.locator(`${dialog} mark .syntax-token`).count());
    assert(
      await page
        .locator(`${dialog} mark .syntax-token`)
        .evaluateAll((spans) =>
          spans.every(
            (span) => getComputedStyle(span).color === getComputedStyle(span.closest("mark")).color,
          ),
        ),
    );
  }
  await annotations();
  await page.screenshot({ path: "/tmp/publr-highlighting-markers.png", fullPage: true });
  await page.locator("#walkthrough-next").click();
  assert(await page.locator('#walkthrough code[data-syntax="markup"] .tag').count());
  await page.getByRole("tab", { name: "stores.js", exact: true }).click();
  assert(await page.locator('#walkthrough code[data-syntax="javascript"] .keyword').count());
  await annotations();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/publr-highlighting-mobile.png", fullPage: true });
  assert(await page.locator("#walkthrough").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/learn/shared-state`);
  await page.locator("#share-count").click();
  for (const [index, filename, language] of [
    [0, "shared-counter.ts", "typescript"],
    [1, "SharedCounter.ptsx", "tsx"],
  ]) {
    await page.getByRole("tab", { name: filename, exact: true }).click();
    const snippet = page.locator(`#sharing-file-panel-${index} code`);
    assert.equal(await snippet.getAttribute("data-syntax"), language);
    assert.equal(await snippet.textContent(), (await readFile(demoFile(filename), "utf8")).trim());
    assert(await snippet.locator(".keyword").count());
    if (language === "tsx") assert(await snippet.locator(".tag").count());
    await annotations("#sharing-guide");
  }
  await page.locator("#sharing-guide-back").click();
  assert(await page.locator("#sharing-file-panel-0 code .keyword").count());
  await page.screenshot({ path: "/tmp/publr-highlighting-sharing.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.locator("#sharing-guide").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  );
  await page.screenshot({ path: "/tmp/publr-highlighting-sharing-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Highlighting passed: TSX source, JS and HTML walkthroughs, shared-state TS/TSX guide, exact text, annotation colors, and mobile overflow.",
  );
} finally {
  await browser.close();
}
