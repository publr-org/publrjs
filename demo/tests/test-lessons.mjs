import { demoFile } from "../paths.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
import { lessons } from "../server/lessons.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto(base);
  assert.equal(await staticPage.locator("#example output").textContent(), "0");
  await staticPage.goto(`${base}/learn/dom`);
  assert.equal(await staticPage.locator("#example").innerHTML(), "");
  await staticPage.goto(`${base}/learn/navigation/b`);
  assert.equal(await staticPage.locator("#example h2").textContent(), "Page B");
  await noJS.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const operations = [];
  let documents = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/_publr/")) operations.push(request);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
  });
  const start = async () => {
    await page.locator("#start").click();
    await page.waitForFunction(() => document.querySelector("#start").textContent === "Active");
  };
  await page.goto(base);
  await page.waitForFunction(() =>
    document.querySelector("#source-code").textContent.includes("export function SimpleCounter"),
  );
  await page.evaluate(() => {
    window.originalOutput = document.querySelector("#example output");
  });
  const initialResponse = await page.locator("#response-code").textContent();
  assert.match(initialResponse, /<output/);
  assert.match(initialResponse, /data-p-store/);
  assert(!initialResponse.includes("p-island"));
  assert(!initialResponse.includes("p-fragment"));
  assert.equal(await page.locator("#example > div[data-p-store]").count(), 1);
  // Unbound SSR controls do nothing until explicitly hydrated.
  await page.getByRole("button", { name: "Increment" }).click();
  assert.equal(await page.locator("#example output").textContent(), "0");
  await start();
  await page.getByRole("button", { name: "Increment" }).click();
  assert.equal(await page.locator("#example output").textContent(), "1");
  assert(
    await page.evaluate(() => window.originalOutput === document.querySelector("#example output")),
  );
  assert.equal(await page.locator("#response-code").textContent(), initialResponse);
  assert.match(await page.locator("#dom-code").textContent(), />1</);
  assert.equal(operations.length, 0);
  await page.getByRole("tab", { name: "Response HTML" }).click();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#tab-dom").getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: "Source", exact: true }).click();
  await page.screenshot({ path: "/tmp/publr-focused-desktop.png", fullPage: true });

  await page.goto(`${base}/learn/html`);
  await start();
  await page.getByRole("button", { name: "Increment" }).click();
  assert.equal(await page.locator("#example output").textContent(), "1");
  assert.equal(await page.locator("#example output").getAttribute("data-p-text"), "$count");
  assert.equal(await page.locator("#example p-island").count(), 0);
  assert.equal(operations.length, 0);

  await page.goto(`${base}/learn/dom`);
  assert.equal(await page.locator("#example").innerHTML(), "");
  await start();
  await page.getByRole("button", { name: "Increment" }).click();
  assert.equal(await page.locator("#example output").textContent(), "1");
  assert.match(await page.locator("#response-code").textContent(), /Empty host/);
  assert.equal(operations.length, 0);

  await page.goto(`${base}/learn/async`);
  await start();
  await page.getByText("Initial loading — no previous result yet.", { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll("#example li").length === 6);
  assert.equal(operations.length, 1);
  await page.locator("#example input").fill("Ada");
  assert.equal(await page.locator("#example li").count(), 6);
  await page.waitForFunction(() => document.querySelectorAll("#example li").length === 1);
  assert.equal(await page.locator("#example li").textContent(), "Ada Chen");
  await page.getByRole("button", { name: "Fail next request" }).click();
  await page.locator("#example [role=alert]").waitFor();
  assert.equal(await page.locator("#example li").textContent(), "Ada Chen");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#example [role=alert]") &&
      document.querySelector("#example section").getAttribute("aria-busy") === "false",
  );
  assert.equal(await page.locator("#requests > li").count(), operations.length);
  assert.match(await page.locator("#requests").textContent(), /500/);

  await page.goto(`${base}/learn/query-lab`);
  const beforeQuery = operations.length;
  await start();
  await page.locator(".readers").waitFor();
  assert.equal(operations.length - beforeQuery, 1);
  assert.deepEqual(await page.locator(".readers strong").allTextContents(), [
    "6 people",
    "6 people",
  ]);
  await page.getByRole("button", { name: "Invalidate people" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#requests > li").length === 2 &&
      [...document.querySelectorAll("#requests strong")].every((el) =>
        el.textContent.includes("200"),
      ),
  );
  assert.equal(operations.length - beforeQuery, 2);
  await page.getByRole("tab", { name: /Requests/ }).click();
  await page.locator("#requests summary").first().click();
  await page.waitForFunction(() =>
    document.querySelector("#requests pre").textContent.includes("Ada Chen"),
  );
  await page.screenshot({ path: "/tmp/publr-focused-query.png", fullPage: true });

  await page.goto(`${base}/learn/navigation/a`);
  const id = await page.locator("#document-id").textContent();
  const beforeNavigation = documents;
  await start();
  await page.locator("#example input").fill("Keep this draft");
  await page.locator(".link-row").first().getByRole("link", { name: "Page B" }).click();
  await page.waitForURL("**/learn/navigation/b");
  assert.equal(documents, beforeNavigation);
  assert.equal(await page.locator("#example h2").textContent(), "Page B");
  assert.equal(await page.locator("#example input").inputValue(), "Keep this draft");
  assert.equal(await page.locator("#document-id").textContent(), id);
  await page.goBack();
  assert.equal(await page.locator("#example h2").textContent(), "Page A");
  assert.equal(await page.locator("#example input").inputValue(), "Keep this draft");
  await page.locator(".link-row").last().getByRole("link", { name: "Page B" }).click();
  await page.waitForURL("**/learn/navigation/b");
  assert.equal(documents, beforeNavigation + 1);
  assert.equal(await page.locator("#example input").inputValue(), "");
  assert.notEqual(await page.locator("#document-id").textContent(), id);

  // Every source option serves the real file; never a detached tutorial snippet.
  for (const file of new Set(lessons.flatMap((lesson) => lesson.files))) {
    const response = await page.request.get(`${base}/source/${file}`);
    assert.equal(response.status(), 200, file);
    assert.equal(await response.text(), await readFile(demoFile(file), "utf8"), file);
  }
  assert.equal((await page.request.get(`${base}/source/../package.json`)).status(), 404);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const lesson of lessons) {
    await page.goto(`${base}${lesson.path ?? `/learn/${lesson.id}`}`);
    await page.waitForFunction(
      () => document.querySelector("#source-code").textContent !== "Loading source…",
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      lesson.id,
    );
  }
  await page.goto(base);
  await page.waitForFunction(() =>
    document.querySelector("#source-code").textContent.includes("export function"),
  );
  await page.screenshot({ path: "/tmp/publr-focused-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Focused examples passed: SSR without JS, explicit hydration with DOM identity, data-p binding, direct DOM creation, async retention/retry, Query deduplication, SPA/document navigation, real source inspection, keyboard tabs and mobile layout.",
  );
} finally {
  await browser.close();
}
