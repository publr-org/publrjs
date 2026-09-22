import { execFileSync } from "node:child_process";
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
  existsSync,
  mkdtempSync,
} from "node:fs";
import { resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { pages } from "./app/pages.mjs";
import { renderPages } from "./app/render-pages.mjs";
import { demoFile } from "./paths.mjs";
import { build } from "vite-plus";
const root = resolve(import.meta.dirname, "..");
const compiler = resolve(process.env.PJSX_ROOT ?? resolve(root, "../pjsx"));
const run = (file, args, cwd = root) => execFileSync(file, args, { cwd, stdio: "inherit" });
// Keep the last working demo available if any compilation or bundling step fails.
const backup = mkdtempSync(resolve(tmpdir(), "publr-demo-build-"));
const artifacts = [".generated", "dist", "zig-out"].map((name) => ({
  current: resolve(root, "demo", name),
  saved: resolve(backup, name),
}));
for (const artifact of artifacts) {
  if (existsSync(artifact.current)) cpSync(artifact.current, artifact.saved, { recursive: true });
}
try {
  run("zig", ["build", "--summary", "failures"], compiler);
  for (const directory of ["components", "app", "render"])
    rmSync(resolve(root, "demo/.generated", directory), { recursive: true, force: true });
  mkdirSync(resolve(root, "demo/.generated/components"), { recursive: true });
  const binary = resolve(compiler, "zig-out/bin/pjsx");
  for (const name of readdirSync(resolve(root, "demo/examples/components"))
    .filter((file) => file.endsWith(".ptsx"))
    .map((file) => file.slice(0, -5))) {
    run(binary, ["dom", demoFile(`${name}.ptsx`), "--out", "demo/.generated/components"]);
    if (!["CacheLab", "QueryExample"].includes(name)) {
      run(binary, ["zig", demoFile(`${name}.ptsx`), "--out", "demo/.generated/components"]);
      run(binary, ["behavior", demoFile(`${name}.ptsx`), "--out", "demo/.generated/components"]);
    }
  }
  // Compiler output keeps component siblings together; shared state stays authored once.
  for (const name of readdirSync(resolve(root, "demo/.generated/components"))) {
    if (!name.endsWith(".js")) continue;
    const path = resolve(root, "demo/.generated/components", name);
    writeFileSync(
      path,
      readFileSync(path, "utf8").replaceAll('"../state/', '"../../examples/state/'),
    );
  }
  // Give this isolated lesson a readable store name in both real artifacts.
  for (const file of ["Hello.zig", "Hello.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(path, readFileSync(path, "utf8").replace(/Hello_[a-f0-9]+/g, "Hello"));
  }
  // Format this generated module for the teaching snippet without changing its calls.
  for (const name of [
    "StateCounter",
    "DerivedCounter",
    "EffectCounter",
    "ConditionalMessage",
    "ItemList",
    "NameInput",
    "StatusMessage",
    "FocusInput",
    "PersonDetails",
    "AnchoredDetails",
    "FocusDetails",
    "Timer",
    "TimerDemo",
    "Greeting",
    "PropsDemo",
    "PeopleSearch",
    "ResilientSearch",
    "PeopleReader",
    "SharedPeople",
    "ReuseDemo",
    "InstanceCounter",
    "StaticPage",
    "StaticGreeting",
  ]) {
    const path = demoFile(`${name}.js`);
    writeFileSync(
      path,
      execFileSync(resolve(root, "node_modules/.bin/oxfmt"), ["--stdin-filepath", `${name}.js`], {
        input: readFileSync(path),
      }),
    );
  }
  const derivedBindings = [
    ...readFileSync(demoFile("DerivedCounter.behavior.js"), "utf8").matchAll(
      /"(v\d+)": \(\) => (count|doubled)\.read\(\)/g,
    ),
  ];
  for (const file of ["DerivedCounter.zig", "DerivedCounter.behavior.js"]) {
    const path = demoFile(file);
    let code = readFileSync(path, "utf8").replace(/DerivedCounter_[a-f0-9]+/g, "DerivedCounter");
    for (const [, generated, readable] of derivedBindings)
      code = code.replaceAll(generated, readable);
    writeFileSync(path, code);
  }
  for (const file of ["EffectCounter.zig", "EffectCounter.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/EffectCounter_[a-f0-9]+/g, "EffectCounter")
        .replace(/\bv\d+\b/g, "count"),
    );
  }
  for (const file of ["ConditionalMessage.zig", "ConditionalMessage.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(/ConditionalMessage_[a-f0-9]+/g, "Message"),
    );
  }
  for (const file of ["ItemList.zig", "ItemList.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(path, readFileSync(path, "utf8").replace(/ItemList_[a-f0-9]+/g, "List"));
  }
  for (const file of ["NameInput.zig", "NameInput.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/NameInput_[a-f0-9]+/g, "Name")
        .replace(/\bp\d+_0\b/g, "name")
        .replace(/\bp\d+_1\b/g, "updateName"),
    );
  }
  for (const file of ["StatusMessage.zig", "StatusMessage.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/StatusMessage_[a-f0-9]+/g, "Status")
        .replace(/\bp\d+_0\b/g, "status")
        .replace(/\bp\d+_1\b/g, "changeStatus"),
    );
  }
  for (const file of ["FocusInput.zig", "FocusInput.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/FocusInput_[a-f0-9]+/g, "Focus")
        .replace(/\bp\d+_0\b/g, "nameInput"),
    );
  }
  for (const name of [
    "Timer",
    "TimerDemo",
    "Greeting",
    "PropsDemo",
    "InstanceCounter",
    "PeopleSearch",
    "ResilientSearch",
    "PeopleReader",
    "SharedPeople",
    "ReuseDemo",
  ]) {
    for (const file of [`${name}.zig`, `${name}.behavior.js`]) {
      const path = demoFile(file);
      let code = readFileSync(path, "utf8").replace(new RegExp(name + "_[a-f0-9]+", "g"), name);
      if (name === "InstanceCounter") code = code.replace(/\bv\d+\b/g, "count");
      if (name === "Greeting") code = code.replace(/\bv\d+\b/g, "name");
      if (name === "PropsDemo")
        code = code.replace(/\bp\d+_0\b/g, "name").replace(/\bv\d+\b/g, "name");
      if (name === "Timer") code = code.replace(/\bv\d+\b/g, "ticks");
      writeFileSync(path, code);
    }
  }
  const peopleCompanion = readFileSync(demoFile("PeopleSearch.behavior.js"), "utf8");
  const peopleNames = [
    [/"([pv]\d+(?:_\d+)?)": \(\) => people.pending\(\)/, "pending"],
    [/"([pv]\d+(?:_\d+)?)": \(\) => search.read\(\)/, "search"],
    [/"([pv]\d+(?:_\d+)?)": \(\) => people.pending\(\) \?/, "status"],
    [/"([pv]\d+(?:_\d+)?)": \(\) => person\(\).name/, "name"],
  ];
  for (const file of ["PeopleSearch.zig", "PeopleSearch.behavior.js"]) {
    const path = demoFile(file);
    let code = readFileSync(path, "utf8");
    for (const [pattern, name] of peopleNames) {
      const generated = peopleCompanion.match(pattern)?.[1];
      if (generated) code = code.replaceAll(generated, name);
    }
    writeFileSync(path, code);
  }
  // Readable names for the state lesson's real HTML and companion binding.
  for (const file of ["StateCounter.zig", "StateCounter.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/StateCounter_[a-f0-9]+/g, "Counter")
        .replace(/\bv\d+\b/g, "count"),
    );
  }
  for (const file of ["SharedCounter.zig", "SharedCounter.behavior.js"]) {
    const path = demoFile(file);
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .replace(/SharedCounter_[a-f0-9]+/g, "SharedCounter")
        .replace(/\bv\d+\b/g, "count")
        .replace(/\bp\d+_0\b/g, "increment"),
    );
  }
  run(
    "zig",
    ["build", `-Druntime=${compiler}/src/runtime/compiled.zig`, "--summary", "failures"],
    resolve(root, "demo"),
  );
  // Teaching HTML is produced by the native renderer, never authored separately.
  for (const [name, command] of [
    ["SharedCounter", "shared-state"],
    ["DerivedCounter", "derived"],
    ["EffectCounter", "effects"],
    ["ConditionalMessage", "conditional"],
    ["ItemList", "lists"],
    ["NameInput", "inputs"],
    ["StatusMessage", "switch"],
    ["FocusInput", "refs"],
    ["PersonDetails", "portals"],
    ["AnchoredDetails", "position"],
    ["FocusDetails", "focus"],
    ["TimerDemo", "cleanup"],
    ["PropsDemo", "props"],
    ["StaticPage", "composition"],
    ["ReuseDemo", "reuse"],
    ["PeopleSearch", "awaited"],
    ["ResilientSearch", "failure"],
    ["SharedPeople", "query"],
  ])
    writeFileSync(
      demoFile(`${name}.html`),
      execFileSync(resolve(root, "demo/zig-out/bin/team-demo"), [command], { encoding: "utf8" })
        .replace(/<!--\/?p:html:\d+-->/g, "")
        .replace(/><!--p:when-->/g, ">\n  <!--p:when-->")
        .replace(/><output/g, ">\n  <output")
        .replace(/><label/g, ">\n  <label")
        .replace(/<button/g, "\n  <button")
        .replace(/<\/div>/g, "\n</div>"),
    );
  for (const name of [
    "SharedCounter",
    "DerivedCounter",
    "EffectCounter",
    "ConditionalMessage",
    "ItemList",
    "NameInput",
    "StatusMessage",
    "FocusInput",
    "PersonDetails",
    "AnchoredDetails",
    "FocusDetails",
    "Timer",
    "TimerDemo",
    "Greeting",
    "PropsDemo",
    "PeopleSearch",
    "ResilientSearch",
    "SharedPeople",
    "ReuseDemo",
    "InstanceCounter",
    "StaticPage",
    "StaticGreeting",
  ]) {
    if (["Timer", "Greeting", "StaticGreeting", "InstanceCounter"].includes(name)) continue;
    const path = demoFile(`${name}.html`);
    writeFileSync(
      path,
      execFileSync(resolve(root, "node_modules/.bin/oxfmt"), ["--stdin-filepath", `${name}.html`], {
        input:
          name === "ItemList"
            ? readFileSync(path, "utf8").replace(/<!--\/?p:(?:when|insert)-->/g, "")
            : readFileSync(path),
      }),
    );
  }
  writeFileSync(
    resolve(root, "demo/backend/team.d.zig.ts"),
    execFileSync(resolve(root, "demo/zig-out/bin/team-demo"), ["types"]),
  );
  writeFileSync(
    resolve(root, "demo/backend/people.d.zig.ts"),
    execFileSync(resolve(root, "demo/zig-out/bin/team-demo"), ["people-types"]),
  );
  writeFileSync(
    resolve(root, "demo/backend/queries.d.zig.ts"),
    execFileSync(resolve(root, "demo/zig-out/bin/team-demo"), ["query-types"]),
  );
  run(process.execPath, [resolve(compiler, "scripts/check-types.mjs"), "demo"]);
  const alias = {
    "publr/runtime": resolve(root, "src/runtime.ts"),
    "publr/transport": resolve(root, "src/transport.ts"),
    "publr/dom": resolve(root, "src/addons/dom.ts"),
    "publr/html": resolve(root, "src/html.ts"),
  };
  for (const addon of ["dom", "query", "router", "focus", "position", "class-merge"])
    alias[`publr/${addon}`] = resolve(root, `src/addons/${addon}.ts`);
  alias.publr = resolve(root, "src/publr.ts");
  // Compile the application with the same PTSX DOM target used by the lessons.
  for (const folder of ["components", "pages"]) {
    const output = resolve(root, "demo/.generated/app", folder);
    mkdirSync(output, { recursive: true });
    for (const file of readdirSync(resolve(root, "demo/app", folder))) {
      if (!file.endsWith(".ptsx")) continue;
      run(binary, ["dom", resolve(root, "demo/app", folder, file), "--out", output]);
      const generated = resolve(output, file.replace(".ptsx", ".js"));
      writeFileSync(
        generated,
        readFileSync(generated, "utf8").replace(/from "(\.[^"]+)"/g, (match, specifier) => {
          if (specifier.endsWith(".js")) return match;
          return `from "${relative(output, resolve(root, "demo/app", folder, specifier))}"`;
        }),
      );
    }
  }
  const pageEntry = resolve(root, "demo/.generated/app/pages-entry.js");
  writeFileSync(
    pageEntry,
    Object.values(pages)
      .map(
        (name) =>
          `import { ${name} } from "./pages/${["IndexPage", "LearnPage", "SharedStatePage"].includes(name) ? name : "ChapterPages"}.js";`,
      )
      .join("\n") +
      '\nexport { mount } from "publr/dom";\nexport const pages = {' +
      Object.entries(pages)
        .map(([route, name]) => `${JSON.stringify(route)}: ${name}`)
        .join(",") +
      "};\n",
  );
  await build({
    configFile: false,
    logLevel: "warn",
    resolve: { alias },
    build: {
      outDir: resolve(root, "demo/.generated/render"),
      target: "es2022",
      minify: false,
      lib: { entry: pageEntry, formats: ["es"], fileName: () => "pages.mjs" },
    },
  });
  await renderPages(resolve(root, "demo/.generated/render/pages.mjs"));
  mkdirSync(resolve(root, "demo/dist"), { recursive: true });
  await build({
    configFile: false,
    logLevel: "warn",
    resolve: { alias },
    build: {
      outDir: resolve(root, "demo/dist"),
      lib: {
        entry: {
          app: resolve(root, "demo/app/main.ts"),
          demo: resolve(root, "demo/app/combined/main.ts"),
          learn: resolve(root, "demo/app/focused/main.ts"),
          introduction: resolve(root, "demo/chapters/entries/introduction.ts"),
          interaction: resolve(root, "demo/chapters/entries/interaction.ts"),
          state: resolve(root, "demo/chapters/entries/state.ts"),
          cleanup: resolve(root, "demo/chapters/entries/cleanup.ts"),
          awaited: resolve(root, "demo/chapters/entries/awaited.ts"),
          failure: resolve(root, "demo/chapters/entries/failure.ts"),
          query: resolve(root, "demo/chapters/entries/query.ts"),
          "query-frame": resolve(root, "demo/previews/query-frame.ts"),
          "failure-frame": resolve(root, "demo/previews/failure-frame.ts"),
          "awaited-frame": resolve(root, "demo/previews/awaited-frame.ts"),
          reuse: resolve(root, "demo/chapters/entries/reuse.ts"),
          props: resolve(root, "demo/chapters/entries/props.ts"),
          composition: resolve(root, "demo/chapters/entries/composition.ts"),
          refs: resolve(root, "demo/chapters/entries/refs.ts"),
          focus: resolve(root, "demo/chapters/entries/focus.ts"),
          "focus-frame": resolve(root, "demo/previews/focus-frame.ts"),
          position: resolve(root, "demo/chapters/entries/position.ts"),
          "position-frame": resolve(root, "demo/previews/position-frame.ts"),
          portals: resolve(root, "demo/chapters/entries/portals.ts"),
          "portals-frame": resolve(root, "demo/previews/portals-frame.ts"),
          switch: resolve(root, "demo/chapters/entries/switch.ts"),
          inputs: resolve(root, "demo/chapters/entries/inputs.ts"),
          lists: resolve(root, "demo/chapters/entries/lists.ts"),
          conditional: resolve(root, "demo/chapters/entries/conditional.ts"),
          effects: resolve(root, "demo/chapters/entries/effects.ts"),
          "effects-frame": resolve(root, "demo/previews/effects-frame.ts"),
          derived: resolve(root, "demo/chapters/entries/derived.ts"),
          "shared-state": resolve(root, "demo/chapters/entries/shared-state.ts"),
        },
        formats: ["es"],
        fileName: (_format, name) => `${name}.js`,
      },
      target: "es2022",
      minify: false,
      sourcemap: true,
    },
  });
  writeFileSync(
    resolve(root, "demo/dist/theme-init.js"),
    readFileSync(resolve(root, "demo/app/theme/init.js")),
  );
  function stylesheet(path) {
    return readFileSync(path, "utf8").replace(/^@import "(\.[^"]+)";$/gm, (_, file) =>
      stylesheet(resolve(path, "..", file)),
    );
  }
  for (const file of readdirSync(resolve(root, "demo/styles")).filter((file) =>
    file.endsWith(".css"),
  )) {
    writeFileSync(resolve(root, "demo/dist", file), stylesheet(resolve(root, "demo/styles", file)));
  }
  console.log("Demo compiled: native SSR, endpoint dispatch, types and browser bundle.");
} catch (error) {
  for (const artifact of artifacts) {
    rmSync(artifact.current, { recursive: true, force: true });
    if (existsSync(artifact.saved)) cpSync(artifact.saved, artifact.current, { recursive: true });
  }
  throw error;
} finally {
  rmSync(backup, { recursive: true, force: true });
}
