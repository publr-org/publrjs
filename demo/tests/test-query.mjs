import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite-plus";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const names = ["Ada Chen", "Elena Rossi", "Jules Martin"];
const withNoah = ["Noah Williams", ...names];
const frameFor = (selector) => page.frameLocator(`${selector} iframe`);
const ready = (frame) => frame.locator('body[data-loaded="true"]').waitFor();
const count = async (frame) => Number(await frame.locator("body").getAttribute("data-requests"));
async function settled(frame) {
  await frame.locator('body[data-pending="0"]').waitFor();
  await frame.locator('.query-reader[aria-busy="false"]').nth(1).waitFor();
}
async function expectPeople(frame, people) {
  for (const reader of await frame.locator(".query-reader").all()) {
    assert.deepEqual(await reader.locator("li").allTextContents(), people);
  }
  assert.equal(await frame.locator(".query-reader").count(), 2);
}
async function release(frame) {
  await frame.getByRole("button", { name: "Respond now", exact: true }).click();
  await settled(frame);
}
async function choose(frame, label) {
  await frame.getByRole("button", { name: label, exact: true }).click();
}
async function add(frame) {
  await choose(frame, "Add person and invalidate");
  await frame.locator('.query-reader[aria-busy="true"]').nth(1).waitFor();
}
try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/query`);
  assert.deepEqual(await noJS.locator("#server-result li").allTextContents(), [...names, ...names]);
  assert.equal(await noJS.locator("#browser-result").innerHTML(), "");
  await plain.close();
  const now = Date.now();
  await page.clock.setFixedTime(now);
  await page.goto(`${base}/learn/query`);
  await page.locator("#compare-open").waitFor({ state: "visible" });
  const server = frameFor("#server-result");
  const client = frameFor("#browser-result");
  for (const frame of [server, client]) {
    await ready(frame);
    await settled(frame);
    await expectPeople(frame, names);
  }
  assert.equal(await count(server), 0);
  assert.equal(await count(client), 1);
  for (const frame of [server, client]) {
    const before = await count(frame);
    await choose(frame, "Ada");
    await settled(frame);
    await expectPeople(frame, ["Ada Chen"]);
    assert.equal(await count(frame), before + 1);
    await choose(frame, "All people");
    await settled(frame);
    await expectPeople(frame, names);
    assert.equal(await count(frame), before + 1, "Fresh return must not refetch");
    await page.route("**/learn/query/add", (route) => route.fulfill({ status: 503, body: "{}" }));
    await choose(frame, "Add person and invalidate");
    await frame.getByRole("alert").waitFor();
    await expectPeople(frame, names);
    assert.equal(await count(frame), before + 1, "A failed write must not invalidate or requery");
    assert.match(await frame.locator(".query-write-status").innerText(), /Ready to add a person./);
    await page.unroute("**/learn/query/add");
    let commit;
    const commitGate = new Promise((resolve) => {
      commit = resolve;
    });
    await page.route("**/learn/query/add", async (route) => {
      await commitGate;
      await route.continue();
    });
    await choose(frame, "Add person and invalidate");
    await frame.getByText("Saving…", { exact: true }).waitFor();
    assert(
      await frame
        .getByRole("button", { name: "Add person and invalidate", exact: true })
        .isDisabled(),
    );
    assert.equal(await count(frame), before + 1, "Querying must wait for the write to commit");
    commit();
    await frame.locator('body[data-pending="1"]').waitFor();
    await page.unroute("**/learn/query/add");
    await frame.locator('.query-reader[aria-busy="true"]').nth(1).waitFor();
    await expectPeople(frame, names);
    await settled(frame);
    assert.equal(await count(frame), before + 2, "Invalidation must share replacement work");
    await expectPeople(frame, withNoah);
    if (frame === server) await expectPeople(client, names);
  }
  // TTL changes freshness, without scheduling an automatic request.
  const counts = [await count(server), await count(client)];
  await page.clock.setFixedTime(now + 61000);
  await page.waitForTimeout(100);
  assert.deepEqual([await count(server), await count(client)], counts);
  for (const [index, frame] of [server, client].entries()) {
    await choose(frame, "Ada");
    await settled(frame);
    await expectPeople(frame, ["Ada Chen"]);
    await choose(frame, "All people");
    await settled(frame);
    await expectPeople(frame, withNoah);
    assert.equal(await count(frame), counts[index] + 2, "Expired reads must request again");
  }
  for (const frame of [server, client]) {
    const before = await count(frame);
    await add(frame);
    await settled(frame);
    await expectPeople(frame, ["Priya Shah", ...withNoah]);
    assert.equal(await count(frame), before + 1);
    assert.match(await frame.locator(".query-write-status").innerText(), /Person saved./);
  }
  await page.clock.setFixedTime(Date.now());
  const tabs = page.locator('.source [role="tab"]');
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
  await page.screenshot({
    path: "/tmp/publr-query-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
  for (const target of ["zig", "javascript"]) {
    const opener = page.locator(`[data-walkthrough="${target}"]`);
    await opener.click();
    for (let i = 0; i < 16 && !(await page.locator(".page-debugger-control").count()); i++)
      await page.locator("#walkthrough-next").click();
    const inspector = page.locator("#walkthrough .awaited-code");
    assert.match(await inspector.locator("code").innerText(), /No response yet/);
    const control = page.locator(".page-debugger-control");
    await control.click();
    await page.waitForFunction(() => !document.querySelector(".page-debugger-control").disabled);
    const frame = frameFor("#walkthrough");
    await ready(frame);
    if (target === "zig") {
      await expectPeople(frame, names);
      await choose(frame, "Ada");
      assert.equal(await count(frame), 0);
    } else assert.equal(await frame.locator("li").count(), 0);
    await control.click();
    await frame.locator('body[data-active="true"]').waitFor();
    if (target === "javascript") {
      await frame.getByText("Loading people…", { exact: true }).nth(1).waitFor();
      assert.equal(await count(frame), 1);
      await release(frame);
    }
    const before = await count(frame);
    await choose(frame, "Ada");
    await frame.locator('body[data-pending="1"]').waitFor();
    await expectPeople(frame, names);
    await release(frame);
    await expectPeople(frame, ["Ada Chen"]);
    await choose(frame, "All people");
    await settled(frame);
    await expectPeople(frame, names);
    assert.equal(await count(frame), before + 1);
    await add(frame);
    await frame.locator('body[data-pending="1"]').waitFor();
    await expectPeople(frame, names);
    assert.match(await frame.locator(".query-write-status").innerText(), /Person saved./);
    await page.screenshot({
      path: `/tmp/publr-query-${target}-paused.png`,
      animations: "disabled",
      fullPage: true,
    });
    await release(frame);
    assert.equal(await count(frame), before + 2);
    await expectPeople(frame, withNoah);
    assert.match(await inspector.locator("code").innerText(), /Reader A/);
    await add(frame);
    await page.locator("#walkthrough-back").click();
    assert.equal(await page.locator("#walkthrough iframe").count(), 0);
    await page.keyboard.press("Escape");
    assert(await opener.evaluate((el) => el === document.activeElement));
    await opener.click();
    assert.match(await page.locator("#walkthrough-count").innerText(), /Step 1/);
    await page.keyboard.press("Escape");
  }
  await page.locator("#compare-open").click();
  for (let i = 0; i < 16 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  const cells = page.locator('.compare-row[aria-label="Generated code"] .compare-cell');
  const files = await cells.nth(0).locator("pre code").allTextContents();
  const publicDOM = await cells.nth(1).locator("pre code").first().innerText();
  for (const target of ["html", "dom"]) {
    const scratch = await mkdtemp(join(tmpdir(), "publr-query-public-"));
    const manual = await browser.newPage();
    manual.on("pageerror", (error) => errors.push(error.message));
    let requests = 0;
    manual.on("request", (request) => {
      if (request.url().endsWith("/readPeople")) requests++;
    });
    try {
      await writeFile(join(scratch, "request.js"), files[2]);
      await writeFile(join(scratch, "stores.js"), files[1]);
      await writeFile(join(scratch, "SharedPeople.js"), publicDOM);
      const entry = join(scratch, "entry.js");
      await writeFile(
        entry,
        target === "dom"
          ? `import { SharedPeople } from './SharedPeople.js'; import { mount } from 'publr/dom'; let dispose; export function run() { document.body.innerHTML = ''; dispose = mount(document.body, SharedPeople); } export function stop() { dispose(); }`
          : `import './stores.js'; import { activate, destroy } from 'publr'; export function run() { document.body.innerHTML = ${JSON.stringify(files[0])}; activate(document.body); } export function stop() { destroy(document.body); }`,
      );
      const result = await build({
        configFile: false,
        logLevel: "silent",
        resolve: {
          alias: {
            "publr/dom": resolve("src/addons/dom.ts"),
            "publr/query": resolve("src/addons/query.ts"),
            "publr/transport": resolve("src/transport.ts"),
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
      await manual.goto(`${base}/learn/query/frame?id=${crypto.randomUUID()}&controlled=0`);
      await manual.evaluate(async () => (await import("/public-check.js")).run());
      await manual.locator('.query-reader[aria-busy="false"]').nth(1).waitFor();
      await expectPeople(manual, names);
      assert.equal(requests, 1);
      await choose(manual, "Ada");
      await manual.locator('.query-reader[aria-busy="false"]').nth(1).waitFor();
      await expectPeople(manual, ["Ada Chen"]);
      assert.equal(requests, 2);
      assert(
        await manual
          .getByRole("button", { name: "Add person and invalidate", exact: true })
          .isDisabled(),
      );
      await choose(manual, "All people");
      await expectPeople(manual, names);
      assert.equal(requests, 2);
      await add(manual);
      await manual.locator('.query-reader[aria-busy="false"]').nth(1).waitFor();
      assert.equal(requests, 3);
      await expectPeople(manual, withNoah);
      await add(manual);
      await manual.evaluate(async () => (await import("/public-check.js")).stop());
      const stoppedHTML = await manual.locator("body").innerHTML();
      await manual.waitForTimeout(850);
      assert.equal(
        await manual.locator("body").innerHTML(),
        stoppedHTML,
        "Disposed readers must not react to a late response",
      );
      if (target === "dom") assert.equal(await manual.locator("li").count(), 0);
    } finally {
      await manual.close();
      await rm(scratch, { recursive: true, force: true });
    }
  }
  const loaded = page.frameLocator('.compare-row[aria-label="Page loaded"] iframe').nth(0);
  const active = page.frameLocator('.compare-row[aria-label="Interactive"] iframe').nth(0);
  const browserActive = page.frameLocator('.compare-row[aria-label="Interactive"] iframe').nth(1);
  await ready(active);
  await ready(browserActive);
  await ready(loaded);
  await choose(active, "Ada");
  await release(active);
  await expectPeople(active, ["Ada Chen"]);
  await choose(active, "All people");
  await settled(active);
  await add(active);
  await expectPeople(active, names);
  await release(active);
  await expectPeople(active, withNoah);
  await expectPeople(loaded, names);
  assert.equal(await count(loaded), 0);
  await release(browserActive);
  assert.equal(await count(browserActive), 1);
  await expectPeople(browserActive, names);
  await page.screenshot({
    path: "/tmp/publr-query-compare-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.locator("#compare-back").click();
  assert.equal(await page.locator(".compare-row").count(), 3);
  await page.locator("#compare-next").click();
  await ready(active);
  await expectPeople(active, names);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/publr-query-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator("#compare-open").click();
  assert.equal(await page.locator(".compare-row").count(), 1);
  for (let i = 0; i < 16 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  await ready(active);
  await ready(browserActive);
  await page.screenshot({
    path: "/tmp/publr-query-compare-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth));
  for (const iframe of await page.locator("iframe").all()) {
    const frame = await iframe.elementHandle().then((handle) => handle.contentFrame());
    assert(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "Query passed: both targets, shared requests, fresh reuse, TTL without polling, invalidation, public examples, snapshots, tabs, replay, cleanup and mobile layouts.",
  );
} finally {
  await browser.close();
}
