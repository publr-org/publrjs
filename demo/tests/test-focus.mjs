import assert from "node:assert/strict";
import { build } from "vite-plus";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, firefox, webkit } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browserType = { chromium, firefox, webkit }[process.env.BROWSER ?? "chromium"];
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const frameFor = (host) => host.frameLocator("iframe");
const loaded = (frame) => frame.locator('body[data-loaded="true"]').waitFor();
const count = (frame) => frame.locator(".focus-card > p").last().innerText();
async function exercise(frame) {
  assert.equal(await count(frame), "Thanks: 0");
  await frame.locator("#publr-portal .focus-panel").waitFor({ state: "attached" });
  const open = frame.getByRole("button", { name: "Open details", exact: true });
  const thank = frame.getByRole("button", { name: "Thank Ada", exact: true });
  const close = frame.getByRole("button", { name: "Close details", exact: true });
  const focused = (button) => button.evaluate((el) => el === document.activeElement);
  await open.focus();
  await open.press("Enter");
  await thank.waitFor({ state: "visible" });
  await thank.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  assert(await focused(thank), "Opening moves focus to the first dialog button");
  assert(await frame.locator(".focus-card").evaluate((el) => el.inert));
  await thank.press("Shift+Tab");
  assert(await focused(close), "Shift+Tab wraps to the last button");
  await close.press("Tab");
  assert(await focused(thank), "Tab wraps to the first button");
  await thank.press("Enter");
  assert.equal(await count(frame), "Thanks: 1");
  await thank.press("Tab");
  assert(await focused(close));
  await close.press("Escape");
  await frame.locator(".focus-panel").waitFor({ state: "hidden" });
  assert(await focused(open), "Escape returns focus to the trigger");
  assert.equal(await frame.locator(".focus-card").evaluate((el) => el.inert), false);
  await open.press("Enter");
  await thank.waitFor({ state: "visible" });
  await close.click();
  await frame.locator(".focus-panel").waitFor({ state: "hidden" });
  assert(await focused(open), "Close returns focus to the trigger");
  assert.equal(await count(frame), "Thanks: 1");
}

try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/focus`);
  assert.equal(await noJS.locator("#server-result .focus-panel[hidden]").count(), 1);
  assert.equal(await noJS.locator("#server-result .focus-card h3").first().innerText(), "Ada Chen");
  assert.equal(await noJS.locator("#browser-result").innerHTML(), "");
  await plain.close();
  await page.goto(`${base}/learn/focus`);
  await page.locator("#compare-open").waitFor({ state: "visible" });
  for (const id of ["server-result", "browser-result"]) {
    const frame = frameFor(page.locator(`#${id}`));
    await loaded(frame);
    await exercise(frame);
  }
  assert.equal(
    await page.locator("#publr-portal").count(),
    0,
    "Focus stay inside their preview page",
  );
  for (const id of ["server-result", "browser-result"])
    await frameFor(page.locator(`#${id}`))
      .getByRole("button", { name: "Open details", exact: true })
      .click();
  await page.screenshot({
    path: "/tmp/publr-focus-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const target of ["zig", "javascript"]) {
    const opener = page.locator(`[data-walkthrough="${target}"]`);
    await opener.click();
    assert.match(await page.locator("#walkthrough-scene").innerText(), /portal/);
    for (let i = 0; i < 5 && !(await page.locator(".page-debugger-control").count()); i++)
      await page.locator("#walkthrough-next").click();
    const inspector = page.locator("#walkthrough .lesson-code");
    assert(await inspector.getByRole("checkbox", { name: "Show code" }).isChecked());
    assert.match(await inspector.innerText(), /No response yet/);
    await page.locator(".page-debugger-control").click();
    const frame = frameFor(page.locator("#walkthrough-scene"));
    await loaded(frame);
    if (target === "zig") {
      assert.equal(await frame.locator(".focus-card .focus-panel").count(), 1);
      await frame.getByRole("button", { name: "Open details", exact: true }).click();
      assert(await frame.locator(".focus-panel").isHidden());
    } else assert.equal(await frame.locator(".focus-card").count(), 0);
    await page.locator(".page-debugger-control").click();
    await exercise(frame);
    assert.match(await inspector.innerText(), /id="publr-portal"/);
    assert.match(await inspector.innerText(), /Thanks:/);
    assert.match(await inspector.innerText(), /Thank Ada/);
    await page.screenshot({
      path: `/tmp/publr-focus-${target}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.locator(".page-debugger-control").click();
    assert.equal(await page.locator("#walkthrough iframe").count(), 0);
    assert.match(await page.locator("#walkthrough .lesson-code").innerText(), /No response yet/);
    await page.locator("#walkthrough-back").click();
    assert.match(await page.locator("#walkthrough-count").innerText(), /Step 1/);
    await page.keyboard.press("Escape");
    assert(await opener.evaluate((el) => el === document.activeElement));
    await opener.click();
    assert.match(await page.locator("#walkthrough-count").innerText(), /Step 1/);
    await page.keyboard.press("Escape");
  }
  await page.locator("#compare-open").click();
  for (let i = 0; i < 8 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  const rows = page.locator(".compare-row");
  const snapshot = frameFor(rows.nth(2).locator(".compare-cell").first());
  const active = frameFor(rows.nth(3).locator(".compare-cell").first());
  await loaded(snapshot);
  await loaded(active);
  await exercise(active);
  await snapshot.getByRole("button", { name: "Open details", exact: true }).click();
  assert(await snapshot.locator(".focus-panel").isHidden());
  assert.equal(await snapshot.locator(".focus-card .focus-panel").count(), 1);
  const codeCells = rows.nth(1).locator(".compare-cell");
  const files = await codeCells.first().locator("pre code").allTextContents();
  const publicDOM = await codeCells.last().locator("pre code").innerText();
  for (const target of ["html", "dom"]) {
    const scratch = await mkdtemp(join(tmpdir(), "publr-focus-public-"));
    const manual = await browser.newPage({ viewport: { width: 380, height: 450 } });
    manual.on("pageerror", (e) => errors.push(e.message));
    try {
      await writeFile(join(scratch, "stores.js"), files[1]);
      await writeFile(join(scratch, "FocusDetails.js"), publicDOM);
      const entry = join(scratch, "entry.js");
      await writeFile(
        entry,
        target === "dom"
          ? `import { FocusDetails } from './FocusDetails.js'; import { mount } from 'publr/dom'; let dispose; export function run() { document.body.innerHTML = '<div id="app"></div>'; dispose = mount(document.querySelector('#app'), FocusDetails); } export function stop() { dispose(); }`
          : `import './stores.js'; import { activate, destroy } from 'publr'; export function run() { document.body.innerHTML = ${JSON.stringify(files[0])}; activate(document.body); } export function stop() { destroy(document.querySelector('.focus-card')); }`,
      );
      const result = await build({
        configFile: false,
        logLevel: "silent",
        resolve: {
          alias: {
            "publr/dom": resolve("src/addons/dom.ts"),
            "publr/focus": resolve("src/addons/focus.ts"),
            publr: resolve("src/publr.ts"),
          },
        },
        build: { write: false, minify: false, lib: { entry, formats: ["es"] } },
      });
      const code = (Array.isArray(result) ? result[0] : result).output.find(
        (item) => item.type === "chunk" && item.isEntry,
      ).code;
      await manual.route("**/public-check.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body: code }),
      );
      await manual.goto(`${base}/learn/focus/frame`);
      await manual.evaluate(async () => (await import("/public-check.js")).run());
      await exercise(manual);
      await manual.evaluate(async () => (await import("/public-check.js")).stop());
      assert.equal(await manual.locator("#publr-portal .focus-panel").count(), 0);
    } finally {
      await manual.close();
      await rm(scratch, { recursive: true, force: true });
    }
  }
  await page.locator("#compare-back").click();
  assert.equal(await rows.count(), 3);
  await page.locator("#compare-next").click();
  const reopened = frameFor(rows.nth(3).locator(".compare-cell").first());
  await loaded(reopened);
  assert.equal(await count(reopened), "Thanks: 0");
  await page.screenshot({
    path: "/tmp/publr-focus-compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await rows.nth(3).scrollIntoViewIfNeeded();
  await exercise(reopened);
  await reopened.getByRole("button", { name: "Open details", exact: true }).click();
  const bounds = await reopened.locator(".focus-panel").evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight,
    };
  });
  assert(
    bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.bottom <= bounds.height + 1,
  );
  await page.screenshot({
    path: "/tmp/publr-focus-compare-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await page.locator("#compare-close").click();
  await page.locator("#compare iframe").first().waitFor({ state: "detached" });
  assert.equal(await page.locator("#compare iframe").count(), 0);
  await page.screenshot({
    path: "/tmp/publr-focus-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    "Focus passed: both targets, initial focus, Tab/Shift+Tab wrapping, Escape/close return, inert background, public examples, retained snapshots, replay, cleanup and mobile layouts.",
  );
} finally {
  await browser.close();
}
