import assert from "node:assert/strict";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/learn/introduction`);
  const toggle = page.getByRole("button", { name: "Dark mode", exact: true });
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await page.screenshot({ path: "/tmp/publr-app-light-desktop.png" });
  await toggle.focus();
  await page.keyboard.press("Space");
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("publr:theme")), "dark");
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgb(23, 26, 33)",
  );
  await page.getByRole("button", { name: "Expand chapters", exact: true }).click();
  await page.screenshot({ path: "/tmp/publr-app-dark-desktop.png" });
  await page.reload();
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await page.locator('[data-walkthrough="zig"]').click();
  await page.screenshot({ path: "/tmp/publr-app-dark-dialog.png" });
  await page.keyboard.press("Escape");
  await page.goto(`${base}/learn/interaction`);
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Collapse chapters", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const toggleBox = await toggle.boundingBox();
  const heading = await page.locator("main > h1").boundingBox();
  assert(toggleBox.y + toggleBox.height <= heading.y, "Theme control clears the chapter heading");
  await page.screenshot({ path: "/tmp/publr-app-dark-mobile.png" });
  await page.goto(`${base}/learn/focus`);
  await toggle.waitFor();
  const frame = page.frames().find((frame) => frame.url().includes("/learn/focus/frame"));
  assert(frame, "The main preview uses a real isolated document");
  await frame.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await toggle.click();
  await frame.waitForFunction(() => document.documentElement.dataset.theme === "light");
  // Storage events keep another open document in sync.
  const second = await context.newPage();
  await second.goto(`${base}/learn/state`);
  await second.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  await context.close();

  const system = await browser.newContext({ colorScheme: "dark" });
  const systemPage = await system.newPage();
  await systemPage.goto(`${base}/learn/introduction`);
  await systemPage.getByRole("button", { name: "Dark mode", exact: true }).waitFor();
  assert.equal(await systemPage.locator("html").getAttribute("data-theme"), "dark");
  await systemPage.emulateMedia({ colorScheme: "light" });
  await systemPage.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await system.close();

  const blocked = await browser.newContext({ colorScheme: "dark" });
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(`${base}/learn/introduction`);
  await blockedPage.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await blockedPage.locator("html").getAttribute("data-theme"), "light");
  await blocked.close();
  console.log(
    "Theme passed: keyboard toggle, persistence, navigation, system preference, unavailable storage, cross-tab and preview sync, dialogs and mobile bounds.",
  );
} finally {
  await browser.close();
}
