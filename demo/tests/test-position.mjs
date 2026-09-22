import assert from "node:assert/strict";
import { build } from "vite-plus";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const frameFor = (host) => host.frameLocator("iframe");
const loaded = (frame) => frame.locator('body[data-loaded="true"]').waitFor();
const count = (frame) => frame.locator(".position-card > p").last().innerText();
async function exercise(frame) {
  await frame.getByRole("button", { name: "Top", exact: true }).click();
  assert.equal(await count(frame), "Thanks: 0");
  await frame.locator("#publr-portal .position-panel").waitFor({ state: "attached" });
  assert.equal(await frame.locator(".position-card .position-panel").count(), 0);
  await frame.getByRole("button", { name: "Open details", exact: true }).click();
  await frame.locator(".position-panel").waitFor({ state: "visible" });
  await frame
    .locator('.position-panel[data-placement="bottom-start"]')
    .waitFor({ state: "visible" });
  async function bounds() {
    return frame.locator(".position-panel").evaluate((panel) => {
      const anchor = document.querySelector(".position-card > button").getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
        width: innerWidth,
        height: innerHeight,
      };
    });
  }
  let geometry = await bounds();
  assert(
    Math.abs(geometry.top - geometry.anchorBottom - 8) <= 1,
    "Panel starts 8 px below its anchor",
  );
  await frame.getByRole("button", { name: "Right edge", exact: true }).click();
  await frame.locator('.position-panel[data-placement="bottom-end"]').waitFor({ state: "visible" });
  geometry = await bounds();
  assert(
    geometry.left >= 7 && geometry.right <= geometry.width - 7,
    "Cross-axis flip keeps the panel inside the viewport",
  );
  await frame.getByRole("button", { name: "Bottom", exact: true }).click();
  await frame.locator('.position-panel[data-placement="top-start"]').waitFor({ state: "visible" });
  geometry = await bounds();
  assert(
    Math.abs(geometry.anchorTop - geometry.bottom - 8) <= 1,
    "Panel flips 8 px above its anchor",
  );
  const previousTop = geometry.top;
  await frame.locator(".position-stage").evaluate(async (stage) => {
    stage.scrollTop += 30;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  geometry = await bounds();
  assert(Math.abs(previousTop - geometry.top - 30) <= 1, "Panel follows real scene scrolling");
  assert(geometry.top >= 7 && geometry.bottom <= geometry.height - 7);
  await frame.getByRole("button", { name: "Thank Ada", exact: true }).click();
  assert.equal(await count(frame), "Thanks: 1");
  await frame.getByRole("button", { name: "Close details", exact: true }).click();
  await frame.locator(".position-panel").waitFor({ state: "hidden" });
  await frame.getByRole("button", { name: "Open details", exact: true }).click();
  assert.equal(await count(frame), "Thanks: 1");
}
try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/position`);
  assert.equal(await noJS.locator("#server-result .position-panel[hidden]").count(), 1);
  assert.equal(
    await noJS.locator("#server-result .position-card h3").first().innerText(),
    "Ada Chen",
  );
  assert.equal(await noJS.locator("#browser-result").innerHTML(), "");
  await plain.close();
  await page.goto(`${base}/learn/position`);
  await page.locator("#compare-open").waitFor({ state: "visible" });
  for (const id of ["server-result", "browser-result"]) {
    const frame = frameFor(page.locator(`#${id}`));
    await loaded(frame);
    await exercise(frame);
  }
  assert.equal(
    await page.locator("#publr-portal").count(),
    0,
    "Portals stay inside their preview page",
  );
  await page.screenshot({
    path: "/tmp/publr-position-desktop.png",
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
      assert.equal(await frame.locator(".position-card .position-panel").count(), 1);
      await frame.getByRole("button", { name: "Open details", exact: true }).click();
      assert(await frame.locator(".position-panel").isHidden());
    } else assert.equal(await frame.locator(".position-card").count(), 0);
    await page.locator(".page-debugger-control").click();
    await exercise(frame);
    assert.match(await inspector.innerText(), /id="publr-portal"/);
    assert.match(await inspector.innerText(), /Thanks:/);
    assert.match(await inspector.innerText(), /Thank Ada/);
    await page.screenshot({
      path: `/tmp/publr-position-${target}.png`,
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
  assert(await snapshot.locator(".position-panel").isHidden());
  assert.equal(await snapshot.locator(".position-card .position-panel").count(), 1);
  const codeCells = rows.nth(1).locator(".compare-cell");
  const files = await codeCells.first().locator("pre code").allTextContents();
  const publicDOM = await codeCells.last().locator("pre code").innerText();
  for (const target of ["html", "dom"]) {
    const scratch = await mkdtemp(join(tmpdir(), "publr-position-public-"));
    const manual = await browser.newPage({ viewport: { width: 380, height: 470 } });
    manual.on("pageerror", (e) => errors.push(e.message));
    try {
      await writeFile(join(scratch, "stores.js"), files[1]);
      await writeFile(join(scratch, "AnchoredDetails.js"), publicDOM);
      const entry = join(scratch, "entry.js");
      await writeFile(
        entry,
        target === "dom"
          ? `import { AnchoredDetails } from './AnchoredDetails.js'; import { mount } from 'publr/dom'; let dispose; export function run() { document.querySelector('#preview').removeAttribute('data-p-activation'); document.querySelector('#preview').innerHTML = '<div id="app"></div>'; document.querySelector('.position-controls').hidden = false; dispose = mount(document.querySelector('#app'), AnchoredDetails); } export function stop() { dispose(); }`
          : `import './stores.js'; import { activate, destroy } from 'publr'; export function run() { document.querySelector('#preview').removeAttribute('data-p-activation'); document.querySelector('#preview').innerHTML = ${JSON.stringify(files[0])}; document.querySelector('.position-controls').hidden = false; activate(document.querySelector('#preview')); } export function stop() { destroy(document.querySelector('.position-card')); }`,
      );
      const result = await build({
        configFile: false,
        logLevel: "silent",
        resolve: {
          alias: {
            "publr/dom": resolve("src/addons/dom.ts"),
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
      await manual.goto(`${base}/learn/position/frame`);
      await manual.evaluate(async () => (await import("/public-check.js")).run());
      await exercise(manual);
      await manual.evaluate(async () => (await import("/public-check.js")).stop());
      assert.equal(await manual.locator("#publr-portal .position-panel").count(), 0);
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
    path: "/tmp/publr-position-compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await rows.nth(3).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "/tmp/publr-position-compare-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await page.keyboard.press("Escape");
  await page.locator("#compare iframe").first().waitFor({ state: "detached" });
  assert.equal(await page.locator("#compare iframe").count(), 0);
  for (const id of ["server-result", "browser-result"]) {
    const frame = frameFor(page.locator(`#${id}`));
    await frame.getByRole("button", { name: "Top", exact: true }).click();
    const fits = await frame.locator(".position-panel").evaluate(async (panel) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const box = panel.getBoundingClientRect();
      return (
        box.left >= 7 &&
        box.top >= 7 &&
        box.right <= innerWidth - 7 &&
        box.bottom <= innerHeight - 7
      );
    });
    assert(fits, "The open panel must fit the narrow viewport after resizing");
  }
  await page.screenshot({
    path: "/tmp/publr-position-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    "Position passed: both targets, 8 px offset, vertical/cross-axis flip, real scroll following, connected actions, public examples, snapshots, cleanup and mobile layouts.",
  );
} finally {
  await browser.close();
}
