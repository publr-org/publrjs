import { build } from "vite-plus";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const names = ["Ada Chen", "Elena Rossi", "Jules Martin"];
const rows = (frame) => frame.locator("li");
const frameFor = (selector) => page.frameLocator(`${selector} iframe`);
const expectNames = async (frame, expected) => {
  await rows(frame)
    .filter({ hasText: expected[0] ?? "" })
    .first()
    .waitFor();
  assert.deepEqual(await rows(frame).allTextContents(), expected);
};
const ready = async (frame) => {
  await frame.locator('body[data-loaded="true"]').waitFor();
};
const settled = async (frame) => {
  await frame.locator('body[data-pending="0"]').waitFor();
  await frame.locator('[aria-busy="false"]').waitFor();
};
const release = async (frame) => {
  await frame.getByRole("button", { name: "Respond now" }).click();
  await settled(frame);
};
const pendingSearch = async (frame, value) => {
  await frame.getByLabel("Search people").fill(value);
  await frame.locator('[aria-busy="true"]').waitFor();
  await frame.locator('body[data-pending="1"]').waitFor();
};
const typeSearch = async (frame, value) => {
  const before = Number(await frame.locator("body").getAttribute("data-requests"));
  const input = frame.getByLabel("Search people");
  await input.press("ControlOrMeta+A");
  await input.pressSequentially(value, { delay: 50 });
  await frame.locator('[aria-busy="true"]').waitFor();
  assert(
    Number(await frame.locator("body").getAttribute("data-requests")) >= before + value.length,
  );
  assert(await frame.getByLabel("Fail next request", { exact: true }).isChecked());
};
try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/failure`);
  assert.deepEqual(await noJS.locator("#server-result li").allTextContents(), names);
  assert.equal(await noJS.locator("#browser-result").innerHTML(), "");
  await plain.close();

  await page.goto(`${base}/learn/failure`);
  await page.locator("#compare-open").waitFor({ state: "visible" });
  const server = frameFor("#server-result"),
    client = frameFor("#browser-result");
  await ready(server);
  await ready(client);
  await settled(server);
  await settled(client);
  await expectNames(server, names);
  await expectNames(client, names);
  assert.equal(await server.locator("body").getAttribute("data-requests"), "0");
  assert.equal(await client.locator("body").getAttribute("data-requests"), "1");
  await pendingSearch(server, "Ada");
  await expectNames(server, names);
  await settled(server);
  await expectNames(server, ["Ada Chen"]);
  await expectNames(client, names);
  for (const frame of [server, client]) {
    await frame.getByLabel("Fail next request", { exact: true }).check();
    await frame.locator("#fail-next:not(:disabled)").waitFor();
    const previous = await rows(frame).allTextContents();
    await typeSearch(frame, "Elena");
    await settled(frame);
    await frame.getByRole("alert").waitFor();
    assert.equal(await frame.getByLabel("Fail next request", { exact: true }).isChecked(), false);
    assert.deepEqual(await rows(frame).allTextContents(), previous);
    assert.match(await frame.getByRole("alert").innerText(), /503/);
    await frame.getByRole("button", { name: "Retry", exact: true }).click();
    await settled(frame);
    await expectNames(frame, ["Elena Rossi"]);
    assert.equal(await frame.getByRole("alert").count(), 0);
    await frame.getByLabel("Slow next request", { exact: false }).check();
    await frame.locator("#slow-next:not(:disabled)").waitFor();
    await pendingSearch(frame, "Ada");
    await frame.getByLabel("Search people").fill("Jules");
    await frame.locator('[aria-busy="false"]').waitFor();
    await expectNames(frame, ["Jules Martin"]);
    assert(Number(await frame.locator("body").getAttribute("data-superseded")) > 0);
    await page.waitForTimeout(2500);
    await expectNames(frame, ["Jules Martin"]);
  }
  await page.screenshot({
    path: "/tmp/publr-failure-desktop.png",
    fullPage: true,
    animations: "disabled",
  });

  for (const target of ["zig", "javascript"]) {
    const opener = page.locator(`[data-walkthrough="${target}"]`);
    await opener.click();
    for (let i = 0; i < 14 && !(await page.locator(".page-debugger-control").count()); i++)
      await page.locator("#walkthrough-next").click();
    const inspector = page.locator("#walkthrough .awaited-code");
    await inspector.getByLabel("Show code").check();
    assert.match(await inspector.locator("code").innerText(), /No response yet/);
    assert.equal(
      await inspector.evaluate((el) => el.previousElementSibling?.id),
      "walkthrough-scene",
    );
    const control = page.locator(".page-debugger-control");
    await control.click();
    await page.waitForFunction(() => !document.querySelector(".page-debugger-control").disabled);
    const frame = frameFor("#walkthrough");
    await ready(frame);
    const liveCode = inspector.locator("code");
    await page.waitForFunction(
      () => document.querySelector("#walkthrough .awaited-code code")?.textContent?.length,
    );
    const loadedCode = await liveCode.innerText();
    assert(!loadedCode.includes("api-controls"));
    if (target === "zig") assert.match(loadedCode, /Ada Chen/);
    else assert.match(loadedCode, /id="app"/);
    if (target === "zig") {
      await expectNames(frame, names);
      await frame.getByLabel("Search people").fill("ignored");
      assert.equal(await frame.locator("body").getAttribute("data-requests"), "0");
    } else assert.equal(await rows(frame).count(), 0);
    if (target === "javascript") {
      await frame.getByLabel("Fail next request", { exact: true }).check();
      await frame.locator("#fail-next:not(:disabled)").waitFor();
    }
    await control.click();
    await frame.locator('body[data-active="true"]').waitFor();
    if (target === "javascript") {
      await frame.getByText("Loading people…", { exact: true }).waitFor();
      await page.waitForTimeout(950);
      assert.equal(await rows(frame).count(), 0);
      await release(frame);
      await frame.getByRole("alert").waitFor();
      assert.equal(await frame.getByLabel("Fail next request", { exact: true }).isChecked(), false);
      assert.equal(await rows(frame).count(), 0);
      await frame.getByRole("button", { name: "Retry", exact: true }).click();
      await release(frame);
    }
    await expectNames(frame, names);
    await frame.getByLabel("Fail next request", { exact: true }).check();
    await frame.locator("#fail-next:not(:disabled)").waitFor();
    await typeSearch(frame, "Elena");
    await release(frame);
    await frame.getByRole("alert").waitFor();
    assert.equal(await frame.getByLabel("Fail next request", { exact: true }).isChecked(), false);
    await expectNames(frame, names);
    await page.screenshot({ path: `/tmp/publr-failure-${target}-error.png`, fullPage: true });
    await frame.getByRole("button", { name: "Retry", exact: true }).click();
    await release(frame);
    await expectNames(frame, ["Elena Rossi"]);
    await pendingSearch(frame, "");
    await release(frame);
    await expectNames(frame, names);
    await pendingSearch(frame, "Ada");
    await page.waitForTimeout(950);
    await expectNames(frame, names);
    await page.screenshot({
      path: `/tmp/publr-failure-${target}-paused.png`,
      fullPage: true,
      animations: "disabled",
    });
    await release(frame);
    await expectNames(frame, ["Ada Chen"]);
    await page.waitForFunction(() => {
      const code = document.querySelector("#walkthrough .awaited-code code")?.textContent ?? "";
      return code.includes("Ada Chen") && !code.includes(">Elena Rossi<");
    });
    assert.match(await liveCode.innerText(), /Ada Chen/);
    await inspector.getByLabel("Show code").uncheck();
    assert.equal(await inspector.locator("pre").isVisible(), false);
    await frame.getByLabel("Pause response").uncheck();
    await frame.locator("#pause-response:not(:disabled)").waitFor();
    await pendingSearch(frame, "");
    await expectNames(frame, ["Ada Chen"]);
    await settled(frame);
    await expectNames(frame, names);
    await frame.getByLabel("Pause response").check();
    await pendingSearch(frame, "Elena");
    await page.locator("#walkthrough-back").click();
    assert.equal(await page.locator("#walkthrough iframe").count(), 0);
    await page.keyboard.press("Escape");
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    await opener.click();
    assert.match(await page.locator("#walkthrough-count").innerText(), /Step 1/);
    await page.keyboard.press("Escape");
  }

  await page.locator("#compare-open").click();
  for (let i = 0; i < 14 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  assert.equal(await page.locator(".compare-row").count(), 4);
  const requestCode = await page
    .locator('.compare-row[aria-label="Generated code"] .compare-cell')
    .nth(0)
    .locator("pre code")
    .nth(2)
    .innerText();
  assert(!requestCode.includes("publr/runtime"));
  const publicFiles = await page
    .locator('.compare-row[aria-label="Generated code"] .compare-cell')
    .nth(0)
    .locator("pre code")
    .allTextContents();
  const publicDOM = await page
    .locator('.compare-row[aria-label="Generated code"] .compare-cell')
    .nth(1)
    .locator("pre code")
    .first()
    .innerText();
  assert.match(publicDOM, /dom\.element/);
  assert(!publicDOM.includes("data-p-store"));
  for (const target of ["html", "dom"]) {
    const scratch = await mkdtemp(join(tmpdir(), "publr-failure-public-"));
    const manual = await browser.newPage();
    manual.on("pageerror", (error) => errors.push(error.message));
    try {
      await writeFile(join(scratch, "request.js"), requestCode);
      await writeFile(join(scratch, "stores.js"), publicFiles[1]);
      await writeFile(join(scratch, "ResilientSearch.js"), publicDOM);
      const entry = join(scratch, "entry.js");
      await writeFile(
        entry,
        target === "dom"
          ? `import { ResilientSearch } from "./ResilientSearch.js";
import { mount } from "publr/dom";
let dispose;
export function run() { document.body.innerHTML = ""; dispose = mount(document.body, ResilientSearch); }
export function stop() { dispose(); }`
          : `import "./stores.js";
import { activate, destroy } from "publr";
export function run() {
  document.body.innerHTML = ${JSON.stringify(publicFiles[0])};
  activate(document.body);
}
export function stop() { destroy(document.body); }`,
      );
      const result = await build({
        configFile: false,
        logLevel: "silent",
        resolve: {
          alias: {
            "publr/dom": resolve("src/addons/dom.ts"),
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
      await manual.goto(`${base}/learn/failure/preview?target=csr`);
      await manual.evaluate(async () => (await import("/public-check.js")).run());
      await expectNames(manual, names);
      await manual.locator("input").fill("Ada");
      await manual.locator('[aria-busy="true"]').waitFor();
      assert.deepEqual(await rows(manual).allTextContents(), names);
      await manual.locator('[aria-busy="false"]').waitFor();
      await expectNames(manual, ["Ada Chen"]);
      let failOnce = true;
      await manual.route("**/_publr/**", async (route) => {
        if (failOnce) {
          failOnce = false;
          await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
        } else await route.continue();
      });
      await manual.locator("input").fill("Elena");
      await manual.getByRole("alert").waitFor();
      await expectNames(manual, ["Ada Chen"]);
      await manual.getByRole("button", { name: "Retry", exact: true }).click();
      await manual.locator('[aria-busy="false"]').waitFor();
      await expectNames(manual, ["Elena Rossi"]);
      await manual.locator("input").fill("Jules");
      await manual.waitForTimeout(80);
      await manual.locator("input").fill("Elena");
      await manual.locator('[aria-busy="false"]').waitFor();
      await expectNames(manual, ["Elena Rossi"]);
      await manual.locator("input").fill("Nobody");
      await manual.locator('[aria-busy="false"]').waitFor();
      assert.deepEqual(await rows(manual).allTextContents(), []);
      await manual.locator("input").fill("Ada");
      await manual.locator('[aria-busy="true"]').waitFor();
      await manual.evaluate(async () => (await import("/public-check.js")).stop());
      await manual.waitForTimeout(900);
      assert.deepEqual(await rows(manual).allTextContents(), []);
    } finally {
      await manual.close();
      await rm(scratch, { recursive: true, force: true });
    }
  }
  const loadedServer = page.frameLocator('.compare-row[aria-label="Page loaded"] iframe').nth(0);
  const activeServer = page.frameLocator('.compare-row[aria-label="Interactive"] iframe').nth(0);
  const activeClient = page.frameLocator('.compare-row[aria-label="Interactive"] iframe').nth(1);
  await ready(loadedServer);
  await ready(activeServer);
  await ready(activeClient);
  await expectNames(loadedServer, names);
  await pendingSearch(activeServer, "Ada");
  await release(activeServer);
  await expectNames(activeServer, ["Ada Chen"]);
  await expectNames(loadedServer, names);
  assert.equal(await loadedServer.locator("body").getAttribute("data-requests"), "0");
  assert.equal(await rows(activeClient).count(), 0);
  await release(activeClient);
  await expectNames(activeClient, names);
  await page.screenshot({
    path: "/tmp/publr-failure-compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator("#compare-back").click();
  assert.equal(await page.locator(".compare-row").count(), 3);
  await page.locator("#compare-next").click();
  await ready(activeServer);
  await expectNames(activeServer, names);
  await page.keyboard.press("Escape");
  await page.locator("#compare-open").click();
  assert.equal(await page.locator(".compare-row").count(), 1);
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/publr-failure-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator("#compare-open").click();
  for (let i = 0; i < 14 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  await ready(activeServer);
  await ready(activeClient);
  await page.locator('.compare-row[aria-label="Interactive"] .awaited-code input').first().click();
  await page.screenshot({
    path: "/tmp/publr-failure-compare-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth));
  for (const iframe of await page.locator("iframe").all()) {
    const frame = await iframe.elementHandle().then((handle) => handle.contentFrame());
    assert(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "Failure: failure/retry, latest search, public examples, real SSR/CSR data, automatic delay, initial loading, manual release, retained results, isolated snapshots, replay, dismissal, and mobile layout passed.",
  );
} finally {
  await browser.close();
}
