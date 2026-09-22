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
page.on("pageerror", (e) => errors.push(e.message));
const counts = async (host) => host.locator("output").allTextContents();
const independent = async (host) => {
  assert.deepEqual(await counts(host), ["0", "10"]);
  await host.getByRole("button", { name: "Increment", exact: true }).nth(0).click();
  await page.waitForTimeout(50);
  assert.deepEqual(await counts(host), ["1", "10"]);
  await host.getByRole("button", { name: "Increment", exact: true }).nth(1).click();
  await page.waitForTimeout(50);
  assert.deepEqual(await counts(host), ["1", "11"]);
};
try {
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  await noJS.goto(`${base}/learn/reuse`);
  assert.deepEqual(await counts(noJS.locator("#server-result")), ["0", "10"]);
  assert.deepEqual(await counts(noJS.locator("#browser-result")), []);
  assert.equal(
    await noJS.locator("#server-result .lesson-instances").getAttribute("data-p-store"),
    null,
  );
  assert.equal(await noJS.locator("#server-result [data-p-store]").count(), 2);
  assert.deepEqual(
    await noJS
      .locator("#server-result [data-p-store]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-p-store"))),
    ["InstanceCounter", "InstanceCounter"],
  );
  await plain.close();
  await page.goto(`${base}/learn/reuse`);
  await page.locator("#compare-open").waitFor({ state: "visible" });
  await independent(page.locator("#server-result"));
  await independent(page.locator("#browser-result"));
  const sourceTabs = page.locator(".source [role=tab]");
  await sourceTabs.first().focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await sourceTabs.nth(1).getAttribute("aria-selected"), "true");
  await page.screenshot({
    path: "/tmp/publr-reuse-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const target of ["zig", "javascript"]) {
    const opener = page.locator(`[data-walkthrough="${target}"]`);
    await opener.click();
    for (let i = 0; i < 8 && !(await page.locator(".page-debugger-control").count()); i++)
      await page.locator("#walkthrough-next").click();
    const control = page.locator(".page-debugger-control");
    await control.click();
    await page.waitForFunction(() => !document.querySelector(".page-debugger-control").disabled);
    const host = page.locator("#walkthrough .walkthrough-demo");
    if (target === "zig") {
      assert.deepEqual(await counts(host), ["0", "10"]);
      await host.getByRole("button", { name: "Increment" }).first().click();
      assert.deepEqual(await counts(host), ["0", "10"]);
    } else assert.deepEqual(await counts(host), []);
    await control.click();
    await independent(host);
    await page.screenshot({
      path: `/tmp/publr-reuse-${target}-walkthrough.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#walkthrough-back").click();
    assert.match(await page.locator("#walkthrough-title").textContent(), /Separate state/);
    await page.keyboard.press("Escape");
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    await opener.click();
    assert.match(await page.locator("#walkthrough-count").textContent(), /Step 1/);
    await page.keyboard.press("Escape");
  }
  await page.locator("#compare-open").click();
  for (let i = 0; i < 10 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  assert.equal(await page.locator(".compare-row").count(), 4);
  // Execute exactly the public JavaScript shown in the generated-code tabs.
  const scratch = await mkdtemp(join(tmpdir(), "publr-reuse-public-"));
  try {
    const generated = page.locator(".compare-row").nth(1);
    const serverCode = await generated
      .locator(".compare-cell")
      .nth(0)
      .locator("pre code")
      .allTextContents();
    const browserCode = await generated
      .locator(".compare-cell")
      .nth(1)
      .locator("pre code")
      .allTextContents();
    assert.equal(serverCode.length, 2);
    assert(!/querySelector|textContent|init\(/.test(serverCode[1]));
    assert(!serverCode.join("\n").includes('createLocalStore("ReuseDemo"'));
    assert.equal(browserCode.length, 2);
    assert(!browserCode.join("\n").match(/publr\/runtime|captureActions|\$\$/));
    await writeFile(join(scratch, "InstanceCounter.js"), browserCode[1]);
    await writeFile(join(scratch, "ReuseDemo.js"), browserCode[0]);
    for (const target of ["ssr", "csr"]) {
      const entry = join(scratch, `${target}.js`);
      await writeFile(
        entry,
        target === "ssr"
          ? `${serverCode[1]}\nimport { activate } from "publr";\nexport function run(host) { host.innerHTML = ${JSON.stringify(serverCode[0])}; activate(host); }`
          : 'import { ReuseDemo } from "./ReuseDemo.js";\nimport { mount } from "publr/dom";\nexport function run(host) { return mount(host, ReuseDemo); }',
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
      const manual = await browser.newPage();
      manual.on("pageerror", (e) => errors.push(e.message));
      await manual.route("**/public-check.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body: code }),
      );
      await manual.goto(`${base}/learn/reuse/preview?target=csr`);
      await manual.evaluate(async () => {
        const { run } = await import("/public-check.js");
        run(document.querySelector("#app"));
      });
      const host = manual.locator("#app");
      assert.deepEqual(await counts(host), ["0", "10"]);
      await host.getByRole("button", { name: "Increment" }).first().click();
      await manual.waitForTimeout(50);
      assert.deepEqual(await counts(host), ["1", "10"]);
      await host.getByRole("button", { name: "Increment" }).last().click();
      await manual.waitForTimeout(50);
      assert.deepEqual(await counts(host), ["1", "11"]);
      await manual.close();
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  const loaded = page.locator(".compare-row").nth(2).locator(".walkthrough-demo").first();
  await loaded.getByRole("button", { name: "Increment" }).first().click();
  assert.deepEqual(await counts(loaded), ["0", "10"]);
  for (const host of await page.locator(".compare-row").nth(3).locator(".walkthrough-demo").all())
    await independent(host);
  await page.screenshot({
    path: "/tmp/publr-reuse-compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator("#compare-back").click();
  assert.equal(await page.locator(".compare-row").count(), 3);
  await page.locator("#compare-next").click();
  for (const host of await page.locator(".compare-row").nth(3).locator(".walkthrough-demo").all())
    assert.deepEqual(await counts(host), ["0", "10"]);
  await page.keyboard.press("Escape");
  await page.locator("#compare-open").click();
  assert.equal(await page.locator(".compare-row").count(), 1);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/publr-reuse-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator("#compare-open").click();
  for (let i = 0; i < 10 && (await page.locator(".compare-row").count()) < 4; i++)
    await page.locator("#compare-next").click();
  await page.screenshot({
    path: "/tmp/publr-reuse-compare-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert(await page.locator("#compare").evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.keyboard.press("Escape");
  for (const route of ["introduction", "interaction", "composition", "props"]) {
    await page.goto(`${base}/learn/${route}`);
    await page.locator("#compare-open").waitFor({ state: "visible" });
    for (const target of ["zig", "javascript"]) {
      await page.locator(`[data-walkthrough="${target}"]`).click();
      for (let i = 0; i < 8 && !(await page.locator(".page-debugger-control").count()); i++)
        await page.locator("#walkthrough-next").click();
      await page.locator(".page-debugger-control").click();
      await page.waitForFunction(() => !document.querySelector(".page-debugger-control").disabled);
      if (target === "javascript" || route === "interaction" || route === "props")
        await page.locator(".page-debugger-control").click();
      if (route === "props") {
        const host = page.locator("#walkthrough .walkthrough-demo");
        await host.locator("input").fill("Grace");
        await page.waitForTimeout(50);
        assert.deepEqual(await counts(host), ["Grace"]);
      }
      if (route === "composition")
        assert.match(
          await page.locator("#walkthrough .walkthrough-demo").textContent(),
          /Hello, Ada!/,
        );
      await page.keyboard.press("Escape");
    }
    await page.locator("#compare-open").click();
    for (let i = 0; i < 10 && (await page.locator(".compare-row").count()) < 4; i++)
      await page.locator("#compare-next").click();
    assert.equal(await page.locator(".compare-row").count(), 4);
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  console.log(
    "Reuse: SSR/CSR independence, no-JS response, tabs, walkthroughs, replay/reopen, comparison snapshots, mobile overflow and existing lesson smoke checks passed.",
  );
} finally {
  await browser.close();
}
