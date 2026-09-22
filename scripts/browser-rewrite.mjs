import { chromium, firefox, webkit } from "../../pjsx/node_modules/playwright/index.mjs";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("tests/compiled/Users.html", "utf8");
const bundle = readFileSync("tests/compiled/bundles/Users.js");
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/Users.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/Users.js" ? bundle : `<!doctype html><body>${html}</body>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const routes = [];
    await page.route("**/_publr/**", (route) => routes.push(route));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      const { Users, hydrate } = await import("/Users.js");
      window.originalRow = document.querySelector("li");
      window.draft = window.originalRow.querySelector("input");
      window.draft.value = "unsaved";
      window.draft.focus();
      window.draft.setSelectionRange(2, 5);
      window.dispose = hydrate(document.querySelector("[data-p-store]"), Users);
    });
    assert.equal(routes.length, 0, "hydration must not fetch");
    for (const [index, users] of [
      [
        { id: 2, name: "New" },
        { id: 1, name: "Updated" },
      ],
      [
        { id: 1, name: "Reordered" },
        { id: 2, name: "New" },
      ],
    ].entries()) {
      await page.evaluate((index) => {
        const search = document.querySelector("section > input");
        search.value = String(index);
        search.dispatchEvent(new Event("input"));
      }, index);
      await page.waitForFunction(
        () => document.querySelector("section").getAttribute("aria-busy") === "true",
      );
      assert(await page.evaluate(() => document.activeElement === window.draft));
      const route = routes.shift();
      assert(route, "generated endpoint called");
      assert.deepEqual(route.request().postDataJSON(), [String(index)]);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(users) });
      await page.waitForFunction(
        () => document.querySelector("section").getAttribute("aria-busy") === "false",
      );
      assert(
        await page.evaluate(
          () =>
            window.originalRow.isConnected &&
            document.activeElement === window.draft &&
            window.draft.value === "unsaved" &&
            window.draft.selectionStart === 2 &&
            window.draft.selectionEnd === 5,
        ),
        "row identity, focus and draft survive reconciliation",
      );
    }
    await page.evaluate(() => window.dispose());
    assert.deepEqual(errors, []);
    console.log(
      `${name}: native hydration, no duplicate fetch, retained content, keyed reorder, focus, selection and draft preservation passed.`,
    );
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  server.close();
}
