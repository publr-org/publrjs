import assert from "node:assert/strict";
import { chromium } from "../../../pjsx/node_modules/playwright/index.mjs";
const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "introduction",
    "interaction",
    "state",
    "shared-state",
    "derived",
    "effects",
    "conditional",
    "lists",
    "inputs",
    "switch",
    "refs",
    "cleanup",
    "props",
    "composition",
    "reuse",
  ]) {
    await page.goto(`${base}/learn/${route}`);
    if (route === "shared-state") {
      await page.locator("#share-count").click();
      await page.locator("#sharing-guide-next").click();
      await page.locator("#sharing-guide-next").click();
      await page.locator("#sharing-guide").waitFor({ state: "hidden" });
    }
    for (const target of ["zig", "javascript"]) {
      await page.locator(`[data-walkthrough="${target}"]`).click();
      for (let i = 0; i < 16 && !(await page.locator(".page-debugger-control").count()); i++)
        await page.locator("#walkthrough-next").click();
      const inspector = page.locator("#walkthrough .lesson-code");
      assert(await inspector.getByLabel("Show code").isChecked());
      assert.match(await inspector.locator("code").innerText(), /No response yet/);
      const control = page.locator(".page-debugger-control");
      await control.click();
      await page.waitForFunction(() => !document.querySelector(".page-debugger-control").disabled);
      await page.waitForFunction(
        () =>
          !document
            .querySelector("#walkthrough .lesson-code code")
            .textContent.includes("No response yet"),
      );
      const initial = await inspector.locator("code").innerText();
      if (target === "javascript") {
        assert.match(initial, /id="app"/);
        await control.click();
        await page.waitForFunction(
          () =>
            document.querySelector("#walkthrough .lesson-code code").textContent.includes("<") &&
            document
              .querySelector("#walkthrough .walkthrough-demo")
              .classList.contains("is-interactive"),
        );
      } else if (!["introduction", "composition"].includes(route)) await control.click();
      if (route === "state") {
        await page.locator("#walkthrough .walkthrough-demo button").click();
        await page.waitForFunction(
          () =>
            new DOMParser()
              .parseFromString(
                document.querySelector("#walkthrough .lesson-code code").textContent,
                "text/html",
              )
              .querySelector("output")
              ?.textContent.trim() === "1",
        );
      }
      if (route === "effects") {
        const frame = page.frameLocator("#walkthrough iframe");
        await frame.getByRole("button", { name: "Increment" }).click();
        await page.waitForFunction(
          () =>
            new DOMParser()
              .parseFromString(
                document.querySelector("#walkthrough .lesson-code code").textContent,
                "text/html",
              )
              .querySelector("output")
              ?.textContent.trim() === "1",
        );
      }
      if (["introduction", "reuse", "effects"].includes(route) && target === "zig") {
        await page.screenshot({ path: `/tmp/${route}-code-desktop.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        assert(
          await page.locator("#walkthrough").evaluate((el) => el.scrollWidth <= el.clientWidth),
        );
        await inspector.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/${route}-code-mobile.png` });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await inspector.getByLabel("Show code").focus();
      await page.keyboard.press("Escape");
      await page.locator("#walkthrough .lesson-code").waitFor({ state: "detached" });
    }
    await page.locator("#compare-open").click();
    for (let i = 0; i < 16 && (await page.locator(".compare-row").count()) < 4; i++)
      await page.locator("#compare-next").click();
    assert.equal(await page.locator("#compare .lesson-code").count(), 4);
    for (const checkbox of await page.locator("#compare .lesson-code input").all())
      assert(await checkbox.isChecked());
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  console.log(
    "All 15 other chapters: SSR/CSR live inspection, defaults, comparison, cleanup, reactive and iframe updates, and responsive layouts passed.",
  );
} finally {
  await browser.close();
}
