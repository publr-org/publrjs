import { build } from "vite-plus";
import { chromium, firefox, webkit } from "../../pjsx/node_modules/playwright/index.mjs";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const names = ["Hello", "HelperRoot", "Overlay", "Metadata", "Helpers"];
const files = new Map();
const alias = Object.fromEntries(
  ["runtime", "transport", "dom", "focus", "position", "query"].map((name) => [
    "publr/" + name,
    resolve("src/" + (["runtime", "transport"].includes(name) ? name : "addons/" + name) + ".ts"),
  ]),
);
alias["publr/html"] = resolve("src/html.ts");
alias.publr = resolve("src/publr.ts");
mkdirSync("tests/compiled/bundles", { recursive: true });
for (const name of names) {
  const entry = resolve(`tests/compiled/bundles/${name}.acceptance.js`);
  writeFileSync(
    entry,
    `import "../../html/${name}.behavior.js"; export {${name}} from "../${name}.js"; export {mount} from "publr/dom"; export {activate, destroy} from "publr"; export {httpOperation} from "publr/transport";`,
  );
  const result = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias },
    build: { write: false, minify: true, lib: { entry, formats: ["es"] } },
  });
  files.set(
    `/${name}.js`,
    (Array.isArray(result) ? result : [result])
      .flatMap((build) => build.output)
      .filter((output) => output.type === "chunk")
      .map((output) => output.code)
      .join("\n"),
  );
  files.set(`/${name}.html`, readFileSync(`tests/html/${name}.html`, "utf8"));
}
let validations = 0;
let validationRequests = 0;
const server = createServer((request, response) => {
  if (request.url === "/validated") {
    validationRequests++;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "private, max-age=60");
    response.setHeader("ETag", '"example-1"');
    response.setHeader("Vary", "Accept-Language");
    if (request.headers["if-none-match"] === '"example-1"') {
      validations++;
      response.writeHead(304);
      response.end();
    } else response.end(JSON.stringify({ data: "application data", error: null }));
    return;
  }
  response.setHeader("Content-Type", request.url.endsWith(".js") ? "text/javascript" : "text/html");
  response.end(files.get(request.url) ?? "<!doctype html><body></body>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    await page.goto(origin);
    const beforeValidation = validations;
    const beforeRequests = validationRequests;
    const validated = await page.evaluate(async () => {
      const { httpOperation } = await import("/Hello.js");
      const run = httpOperation("/validated");
      return [(await run()).value, (await run()).value];
    });
    assert.deepEqual(validated, [
      { data: "application data", error: null },
      { data: "application data", error: null },
    ]);
    assert.equal(
      validationRequests,
      beforeRequests + 2,
      "GET retention must pass every new operation through Fetch validation",
    );
    // WebKit's headless ephemeral HTTP cache can choose a full response instead.
    if (name !== "webkit")
      assert.equal(validations, beforeValidation + 1, "Fetch merges ETag 304 responses");
    let alerts = 0;
    page.on("dialog", async (dialog) => {
      alerts++;
      await dialog.dismiss();
    });
    await page.goto(origin);
    await page.setContent(files.get("/Hello.html"));
    assert.equal(await page.locator("button").textContent(), "Hello");
    await page.evaluate(() => {
      window.original = document.querySelector("button");
    });
    await page.evaluate(() => import("/Hello.js"));
    await page.locator("button").click();
    assert.equal(alerts, 1);
    assert(await page.evaluate(() => document.querySelector("button") === window.original));
    await page.evaluate((html) => {
      document.body.insertAdjacentHTML("beforeend", html);
    }, files.get("/Hello.html"));
    await page.locator("button").nth(1).click();
    assert.equal(alerts, 2);
    await page.evaluate(() => {
      document.body.append(document.querySelector("button"));
    });
    await page.locator("button").nth(1).click();
    assert.equal(alerts, 3);

    await page.goto(origin);
    await page.setContent(`<table><tbody>${files.get("/HelperRoot.html")}</tbody></table>`);
    assert.equal(
      await page.locator("tbody > template").count(),
      2,
      "HTML parser must preserve template anchors in tbody",
    );
    await page.evaluate(() => {
      window.original = document.querySelector("tr");
    });
    await page.evaluate(() => import("/HelperRoot.js"));
    await page.locator("button").click();
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2);
    assert(await page.evaluate(() => document.querySelector("tr") === window.original));
    await page.evaluate(() => document.querySelector("table").remove());

    // Same-name structural roots use separate nested ranges, never instance IDs.
    await page.goto(origin);
    await page.setContent(
      `<table><tbody>${files.get("/HelperRoot.html")}${files.get("/HelperRoot.html")}<tr id="unrelated"><td>Keep me</td></tr></tbody></table>`,
    );
    await page.evaluate(() => import("/HelperRoot.js"));
    assert.equal(
      await page
        .locator("[data-p-instance],[data-p-component],[data-p-html],[data-p-state]")
        .count(),
      0,
    );
    await page.locator("button").first().click();
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 4);
    assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), [
      "One",
      "Two",
      "One",
      "Keep me",
    ]);
    await page.evaluate(async () => {
      const module = await import("/HelperRoot.js");
      window.secondRow = document.querySelectorAll("tbody tr")[2];
      const start = document.querySelector("[data-p-root-start]");
      const end = document.querySelector("[data-p-root-end]");
      module.destroy(start);
      let node = start;
      while (node) {
        const next = node.nextSibling;
        node.remove();
        if (node === end) break;
        node = next;
      }
    });
    assert.equal(await page.locator("tbody tr").count(), 2);
    assert(await page.evaluate(() => window.secondRow.isConnected));
    await page.locator("button").click();
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 3);
    assert.equal(await page.locator("#unrelated").textContent(), "Keep me");

    for (const native of [false, true]) {
      await page.goto(origin);
      await page.setContent(native ? files.get("/Overlay.html") : "<main></main>");
      await page.evaluate(async (native) => {
        const module = await import("/Overlay.js");
        if (!native) window.dispose = module.mount(document.querySelector("main"), module.Overlay);
      }, native);
      await page.locator("button").focus();
      await page.locator("button").click();
      await page.waitForFunction(
        () => document.querySelector("#publr-portal aside")?.dataset.placement,
      );
      assert(
        await page.evaluate(
          () => document.activeElement === document.querySelector("aside button"),
        ),
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("aside"));
      assert(
        await page.evaluate(() => document.activeElement === document.querySelector("button")),
      );
    }

    await page.goto(origin);
    await page.setContent(files.get("/Metadata.html"));
    let requests = 0;
    await page.route("**/_publr/**", async (route) => {
      requests++;
      await route.abort();
    });
    await page.evaluate(() => {
      const seed = JSON.parse(document.querySelector("[data-p]").getAttribute("data-p"));
      Date.now = () => Math.min(...Object.values(seed.$cache).map((entry) => entry.expires)) - 1000;
      window.original = document.querySelector("p");
    });
    await page.evaluate(async () => {
      const module = await import("/Metadata.js");
      const host = document.createElement("main");
      document.body.append(host);
      module.mount(host, module.Metadata);
    });
    await page.waitForFunction(() => document.querySelectorAll("p").length === 2);
    assert.equal(
      requests,
      0,
      "transferred cache entries must serve another owner without a duplicate operation",
    );
    assert(await page.evaluate(() => document.querySelector("p") === window.original));
    assert.equal(await page.locator("p").first().textContent(), "payload / field / 7");
    assert.deepEqual(errors, []);
    console.log(
      `${name}: automatic Hello activation, inserted/moved HTML, parser-safe helper roots, overlay focus/dismissal, metadata and cache transfer passed.`,
    );
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  server.close();
}
