import assert from "node:assert/strict";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/learn/introduction`);
  const menu = page.getByRole("button", { name: "Expand chapters", exact: true });
  const sidebar = page.locator("#chapter-sidebar");
  const collapse = page.getByRole("button", { name: "Collapse chapters", exact: true });
  await menu.waitFor();
  assert.equal(await sidebar.isVisible(), false);
  await menu.click();
  assert.equal(await menu.isVisible(), false);
  assert.equal(await sidebar.evaluate((el) => el.tagName), "ASIDE");
  assert.equal(await sidebar.locator('a[aria-current="page"]').innerText(), "Introduction");
  const routes = await sidebar
    .locator("a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.equal(routes.length, 21);
  assert.equal(await sidebar.locator(".chapter-planned").count(), 5);
  assert((await page.locator("main").boundingBox()).x >= 300);
  assert((await page.locator(".step-navigation").boundingBox()).x >= 300);
  await page.locator('[data-walkthrough="zig"]').click();
  await page.locator("#walkthrough-close").click();
  assert(await sidebar.isVisible(), "Using the lesson does not collapse navigation");
  await page.screenshot({ path: "/tmp/publr-sidebar-desktop.png" });
  await sidebar.getByRole("link", { name: "Focus", exact: true }).click();
  await page.waitForURL(`${base}/learn/focus`);
  await collapse.waitFor();
  assert.equal(await sidebar.locator('a[aria-current="page"]').innerText(), "Focus");
  await page.reload();
  await collapse.waitFor();
  for (const route of routes) {
    await page.goto(base + route);
    await collapse.waitFor();
    assert.equal(await sidebar.locator('a[aria-current="page"]').getAttribute("href"), route);
  }
  await collapse.click();
  assert(await menu.evaluate((el) => el === document.activeElement));
  await page.reload();
  await menu.waitFor();
  assert.equal(await sidebar.isVisible(), false);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await menu.click();
    const navBounds = await sidebar.boundingBox();
    const mainBounds = await page.locator("main").boundingBox();
    assert(
      mainBounds.y >= navBounds.y + navBounds.height,
      "Expanded navigation takes layout space",
    );
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/publr-sidebar-mobile-${width}.png` });
    await collapse.click();
    const menuBounds = await menu.boundingBox();
    const titleBounds = await page.locator("main > h1").boundingBox();
    assert(menuBounds.y + menuBounds.height <= titleBounds.y);
    await page.screenshot({ path: `/tmp/publr-sidebar-collapsed-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Sidebar passed: persistent expanded/collapsed state, all 21 routes, active chapter, usable lesson while expanded, layout space and mobile bounds.",
  );
} finally {
  await browser.close();
}
