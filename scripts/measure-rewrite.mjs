import { build } from "vite-plus";
import { Window } from "happy-dom";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const root = process.cwd();
const alias = {
  "publr/focus": resolve(root, "src/addons/focus.ts"),
  "publr/position": resolve(root, "src/addons/position.ts"),
  "publr/query": resolve(root, "src/addons/query.ts"),
  "publr/router": resolve(root, "src/addons/router.ts"),
  "publr/runtime": resolve(root, "src/runtime.ts"),
  "publr/transport": resolve(root, "src/transport.ts"),
  "publr/html": resolve(root, "src/html.ts"),
  "publr/dom": resolve(root, "src/addons/dom.ts"),
  publr: resolve(root, "src/publr.ts"),
};
const results = {};
mkdirSync("tests/compiled/bundles", { recursive: true });
for (const name of ["Counter", "List", "Users", "Pair", "UsersHTML"]) {
  const component = name === "UsersHTML" ? "Users" : name;
  const entry =
    name === "UsersHTML"
      ? `import "../../html/Users.behavior.js"; export {hydrate, destroy} from "publr";`
      : `import {mount, hydrate} from "publr/dom"; import {${name}} from "../${name}.js"; export {mount, hydrate, ${name}};`;
  const file = `tests/compiled/bundles/${name}.entry.js`;
  writeFileSync(file, entry);
  const result = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias },
    build: {
      write: false,
      lib: { entry: resolve(file), formats: ["es"], fileName: name },
      minify: true,
      target: "es2022",
      rolldownOptions: { input: resolve(file), output: { format: "es" } },
    },
  });
  const code = (Array.isArray(result) ? result : [result])
    .flatMap((x) => x.output)
    .filter((x) => x.type === "chunk")
    .map((x) => x.code)
    .join("\n");
  if (name === "UsersHTML" && (!code.includes("Users_") || !code.includes("same-origin")))
    throw new Error("HTML companion registration or transport was tree-shaken away");
  if (name === "UsersHTML" && /publr-dom:|unclaimed region content|hydration mismatch/.test(code))
    throw new Error("HTML companion unexpectedly includes the DOM replay renderer");
  writeFileSync(`tests/compiled/bundles/${name}.js`, code);
  const htmlPath = `tests/${name === "UsersHTML" ? "html" : "compiled"}/${component}.html`;
  const html = existsSync(htmlPath) ? readFileSync(htmlPath) : Buffer.alloc(0);
  results[name] = {
    javascript: Buffer.byteLength(code),
    gzip: gzipSync(code).length,
    brotli: brotliCompressSync(code).length,
    html: html.length,
    htmlGzip: gzipSync(html).length,
    state: (() => {
      const document = new Window().document;
      document.body.innerHTML = html.toString();
      return [...document.querySelectorAll("[data-p]")].reduce(
        (sum, el) => sum + Buffer.byteLength(el.getAttribute("data-p")),
        0,
      );
    })(),
  };
  if (
    name === "Counter" &&
    /Native operation failed|createQueryCache|same-origin|Reactive dependency is pending.*operation/s.test(
      code,
    )
  )
    throw new Error("Counter includes unused async/transport code");
}
writeFileSync("docs/bundle-sizes.json", JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));

if (existsSync("docs/bundle-budgets.json")) {
  const budgets = JSON.parse(readFileSync("docs/bundle-budgets.json", "utf8"));
  for (const [name, sizes] of Object.entries(results))
    for (const metric of ["javascript", "gzip", "brotli", "html"])
      if (sizes[metric] > budgets[name][metric])
        throw new Error(`${name} ${metric}: ${sizes[metric]} exceeds ${budgets[name][metric]}`);
}
