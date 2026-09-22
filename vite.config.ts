import { defineConfig } from "vite-plus";

const BANNER = `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — built by Vite from publr-js/src/ (TypeScript).
// DO NOT EDIT. Edit publr-js/src/** and rebuild.
// ─────────────────────────────────────────────────────────────────────────────`;

// Multiple entry points share graph, ownership and scheduler chunks.
export default defineConfig({
  // dist/ is a local build product; keep lint/fmt off it.
  lint: {
    ignorePatterns: [
      "dist/**",
      "demo/dist/**",
      "demo/.zig-cache/**",
      "demo/zig-out/**",
      "demo/.generated/**",
      "demo/backend/*.d.zig.ts",
      "tests/fixtures/*.js",
      "tests/compiled/*.js",
      "tests/html/*.js",
      "tests/html/*.html",
      "tests/html/.zig-cache/**",
      "tests/html/backend/*.d.zig.ts",
      "tests/compiled/bundles/**",
      "tests/compiled/backend/*.d.zig.ts",
      "tests/compiled/*.html",
      "tests/compiled/.zig-cache/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      // The runtime deliberately coerces unknown wire/model values with
      // String(...) — that IS the directive contract, not an accident.
      "typescript/no-base-to-string": "off",
    },
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      "demo/dist/**",
      "demo/.zig-cache/**",
      "demo/zig-out/**",
      "demo/.generated/**",
      "demo/backend/*.d.zig.ts",
      "tests/fixtures/*.js",
      "tests/compiled/*.js",
      "tests/html/*.js",
      "tests/html/*.html",
      "tests/html/.zig-cache/**",
      "tests/html/backend/*.d.zig.ts",
      "tests/compiled/bundles/**",
      "tests/compiled/backend/*.d.zig.ts",
      "tests/compiled/*.html",
      "tests/compiled/.zig-cache/**",
    ],
  },
  resolve: {
    alias: {
      "publr/html": new URL("./src/html.ts", import.meta.url).pathname,
      "publr/dom": new URL("./src/addons/dom.ts", import.meta.url).pathname,
      "publr/focus": new URL("./src/addons/focus.ts", import.meta.url).pathname,
      "publr/position": new URL("./src/addons/position.ts", import.meta.url).pathname,
      "publr/query": new URL("./src/addons/query.ts", import.meta.url).pathname,
      "publr/router": new URL("./src/addons/router.ts", import.meta.url).pathname,
      "publr/class-merge": new URL("./src/addons/class-merge.ts", import.meta.url).pathname,
      "publr/runtime": new URL("./src/runtime.ts", import.meta.url).pathname,
      "publr/transport": new URL("./src/transport.ts", import.meta.url).pathname,
      "publr-dom": new URL("./src/addons/dom.ts", import.meta.url).pathname,
      publr: new URL("./src/publr.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "happy-dom",
  },
  build: {
    target: "es2022",
    outDir: "dist",
    // The output is read and debugged in-browser; keep it human-readable until
    // `pjsx minify` owns the shipped form.
    minify: false,
    rollupOptions: {
      input: {
        publr: "src/publr.ts",
        "publr-query": "src/addons/query.ts",
        "publr-router": "src/addons/router.ts",
        "publr-dom": "src/addons/dom.ts",
        "publr-html": "src/html.ts",
        "publr-runtime": "src/runtime.ts",
        "publr-transport": "src/transport.ts",
        "publr-focus": "src/addons/focus.ts",
        "publr-position": "src/addons/position.ts",
        "publr-class-merge": "src/addons/class-merge.ts",
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        banner: BANNER,
      },
      // "strict" would emit publr.js as a tiny facade re-exporting a shared
      // chunk (the query entry also imports the core). allow-extension keeps
      // the whole core IN dist/publr.js — extra exports are harmless there.
      preserveEntrySignatures: "allow-extension",
    },
  },
});
