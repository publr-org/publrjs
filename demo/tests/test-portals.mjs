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
const count = (frame) => frame.locator(".portal-clip > p").last().innerText();
async function exercise(frame) {
  assert.equal(await count(frame), "Thanks: 0");
  await frame.locator("#publr-portal .portal-panel").waitFor({ state: "attached" });
  assert.equal(await frame.locator(".portal-clip .portal-panel").count(), 0);
  await frame.getByRole("button", { name: "Open details", exact: true }).click();
  await frame.locator(".portal-panel").waitFor({ state: "visible" });
  const geometry = await frame.locator(".portal-panel").evaluate((panel) => {
    const clip = document.querySelector(".portal-clip");
    return {
      bottom: panel.getBoundingClientRect().bottom,
      clipBottom: clip.getBoundingClientRect().bottom,
      overflow: getComputedStyle(clip).overflow,
      viewport: innerHeight,
    };
  });
  assert.equal(geometry.overflow, "hidden");
  assert(geometry.bottom > geometry.clipBottom, "Panel must visibly escape the clipping boundary");
  await frame.getByRole("button", { name: "Thank Ada", exact: true }).click();
  assert.equal(await count(frame), "Thanks: 1");
  await frame.getByRole("button", { name: "Close details", exact: true }).click();
  await frame.locator(".portal-panel").waitFor({ state: "hidden" });
  await frame.getByRole("button", { name: "Open details", exact: true }).click();
  assert.equal(await count(frame), "Thanks: 1");
}
try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/portals`);
  assert.equal(await noJS.locator("#server-result .portal-panel[hidden]").count(), 1);
  assert.equal(
    await noJS.locator("#server-result .portal-clip h3").first().innerText(),
    "Ada Chen",
  );
  assert.equal(await noJS.locator("#browser-result").innerHTML(), "");
  await plain.close();
  await page.goto(`${base}/learn/portals`);
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
    path: "/tmp/publr-portals-desktop.png",
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
      assert.equal(await frame.locator(".portal-clip .portal-panel").count(), 1);
      await frame.getByRole("button", { name: "Open details", exact: true }).click();
      assert(await frame.locator(".portal-panel").isHidden());
    } else assert.equal(await frame.locator(".portal-clip").count(), 0);
    await page.locator(".page-debugger-control").click();
    await exercise(frame);
    assert.match(await inspector.innerText(), /id="publr-portal"/);
    assert.match(await inspector.innerText(), /Thanks:/);
    assert.match(await inspector.innerText(), /Thank Ada/);
    await page.screenshot({
      path: `/tmp/publr-portals-${target}.png`,
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
  assert(await snapshot.locator(".portal-panel").isHidden());
  assert.equal(await snapshot.locator(".portal-clip .portal-panel").count(), 1);
  const codeCells = rows.nth(1).locator(".compare-cell");
  const files = await codeCells.first().locator("pre code").allTextContents();
  const publicDOM = await codeCells.last().locator("pre code").innerText();
  for (const target of ["html", "dom"]) {
    const scratch = await mkdtemp(join(tmpdir(), "publr-portals-public-"));
    const manual = await browser.newPage({ viewport: { width: 380, height: 450 } });
    manual.on("pageerror", (e) => errors.push(e.message));
    try {
      await writeFile(join(scratch, "stores.js"), files[1]);
      await writeFile(join(scratch, "PersonDetails.js"), publicDOM);
      const entry = join(scratch, "entry.js");
      await writeFile(
        entry,
        target === "dom"
          ? `import { PersonDetails } from './PersonDetails.js'; import { mount } from 'publr/dom'; let dispose; export function run() { document.body.innerHTML = '<div id="app"></div>'; dispose = mount(document.querySelector('#app'), PersonDetails); } export function stop() { dispose(); }`
          : `import './stores.js'; import { activate, destroy } from 'publr'; export function run() { document.body.innerHTML = ${JSON.stringify(files[0])}; activate(document.body); } export function stop() { destroy(document.querySelector('.portal-clip')); }`,
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
      await manual.goto(`${base}/learn/portals/frame`);
      await manual.evaluate(async () => (await import("/public-check.js")).run());
      await exercise(manual);
      await manual.evaluate(async () => (await import("/public-check.js")).stop());
      assert.equal(await manual.locator("#publr-portal .portal-panel").count(), 0);
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
    path: "/tmp/publr-portals-compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await rows.nth(3).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "/tmp/publr-portals-compare-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  await page.keyboard.press("Escape");
  await page.locator("#compare iframe").first().waitFor({ state: "detached" });
  assert.equal(await page.locator("#compare iframe").count(), 0);
  await page.screenshot({
    path: "/tmp/publr-portals-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    "Portals passed: native HTML, both targets, escaped bounds, connected state/actions, public examples, retained snapshots, replay, cleanup and mobile layouts.",
  );
} finally {
  await browser.close();
}
