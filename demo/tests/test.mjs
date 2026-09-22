import assert from "node:assert/strict";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true });
const baseURL = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(`${baseURL}/combined`);
  await page.waitForFunction(() => document.querySelector("#owner-count").textContent === "6");
  assert.equal(await page.locator("#request-count").textContent(), "0");
  const ada = page.locator('[data-member="1"]');
  await ada.locator("input").fill("Ask about the prototype");
  await ada.locator("button").click();
  await page.evaluate(() => {
    window.adaCard = document.querySelector('[data-member="1"]');
    window.note = window.adaCard.querySelector("input");
    window.note.focus();
    window.note.setSelectionRange(2, 5);
    document.querySelector(".controls > button").click();
  });
  await page.waitForFunction(
    () => document.querySelector(".directory").getAttribute("aria-busy") === "true",
  );
  assert.equal(await page.locator(".member-card").first().getAttribute("data-member"), "1");
  await page.waitForFunction(
    () => document.querySelector(".directory").getAttribute("aria-busy") === "false",
  );
  assert.equal(await page.locator(".member-card").first().getAttribute("data-member"), "6");
  assert(
    await page.evaluate(
      () =>
        document.querySelector('[data-member="1"]') === window.adaCard &&
        document.activeElement === window.note &&
        window.note.selectionStart === 2 &&
        window.note.selectionEnd === 5,
    ),
  );
  assert.equal(await ada.locator("input").inputValue(), "Ask about the prototype");
  assert.equal(await ada.locator("button").getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Simulate a failure" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator(".member-card").count(), 6);
  assert.equal(await ada.locator("input").inputValue(), "Ask about the prototype");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".directory").getAttribute("aria-busy") === "false" &&
      !document.querySelector('[role="alert"]'),
  );
  // Two rapid requests: the second finishes first and owns the final result.
  await page.locator("select").selectOption("1800");
  await page.locator("#search").fill("Elena");
  await page.locator("select").selectOption("150");
  await page.locator("#search").fill("Ada");
  await page.waitForFunction(
    () => document.querySelector(".directory").getAttribute("aria-busy") === "false",
  );
  await page.waitForTimeout(1900);
  assert.deepEqual(await page.locator(".member-card h3").allTextContents(), ["Ada Chen"]);
  assert.equal(await page.locator(".bridge-value").textContent(), "Ada");
  await page.getByRole("button", { name: "Reset from HTML" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".member-card").length === 6 &&
      document.querySelector(".directory").getAttribute("aria-busy") === "false",
  );
  assert.equal(await ada.locator("input").inputValue(), "Ask about the prototype");
  await page.getByRole("link", { name: "Runtime lab" }).click();
  assert.equal(documents, 1);
  assert(await page.locator("#client-mode").isHidden());
  await page.waitForFunction(() =>
    document.querySelector(".cache-footer")?.textContent.includes("same result"),
  );
  assert.match(await page.locator(".cache-footer").textContent(), /^1 native requests/);
  await page.getByRole("button", { name: "Invalidate tag" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".cache-footer")?.textContent.startsWith("2 native requests") &&
      document.querySelector(".cache-footer")?.textContent.includes("same result"),
  );
  await page.getByRole("button", { name: "Increase Counter A" }).click();
  assert.deepEqual(await page.locator(".counter-card output").allTextContents(), ["3", "7"]);
  assert.equal(
    await page.locator(".counter-card").first().locator(".counter-facts").textContent(),
    "Derived 6Snapshot 2",
  );
  await page.getByRole("button", { name: "Unmount counter B", exact: true }).click();
  assert.equal(await page.locator(".counter-card").count(), 1);
  await page.getByRole("button", { name: "Mount a fresh counter B" }).click();
  assert.deepEqual(await page.locator(".counter-card output").allTextContents(), ["3", "7"]);
  await page.getByRole("button", { name: "Take a little tour" }).click();
  assert.equal(await page.locator("#guide").evaluate((el) => el.parentElement.id), "publr-portal");
  await page.keyboard.press("Escape");
  assert(await page.locator("#guide").isHidden());
  assert(await page.locator("#guide-button").evaluate((el) => el === document.activeElement));
  await page.getByRole("link", { name: "The directory" }).click();
  assert.equal(await ada.locator("input").inputValue(), "Ask about the prototype");
  assert.equal(documents, 1);
  await page.screenshot({ path: "/tmp/publr-team-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Client mount", exact: true }).click();
  await page.locator(".loading-state").waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".member-card").length === 6 &&
      document.querySelector(".directory").getAttribute("aria-busy") === "false",
  );
  assert.equal(await ada.locator("input").inputValue(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "/tmp/publr-team-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Combined demo passed: hydration, chained native requests, keyed drafts/focus, errors, supersession, HTML stores, Query sharing, owner cleanup, routing, portal/focus, client mount and mobile layout.",
  );
} finally {
  await browser.close();
}
