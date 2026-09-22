# PublrJS

Publr's shared reactive runtime and compiler-oriented DOM target. PJSX authors
write ordinary values and assignments; the compiler emits graph bindings,
specialized DOM factories, native Zig calls and hydration companions.

```tsx
import { state, derived, effect } from "publr";

export function Counter(props: { initial: number }) {
  let count = state(props.initial);
  const initial = count;
  const doubled = derived(() => count * 2);
  function increment() {
    count++;
  }
  effect(() => console.log(count, doubled));
  return (
    <button onClick={increment}>
      {count} / {doubled} / {initial}
    </button>
  );
}
```

Compile with the sibling PJSX CLI, then mount the generated module:

```sh
cd ../pjsx
zig build
zig-out/bin/pjsx dom ../publr-js/tests/compiled/Counter.ptsx --out ../publr-js/tests/compiled
```

```js
import { mount } from "publr/dom";
import { Counter } from "./Counter.js";
const dispose = mount(document.querySelector("#app"), Counter, { initial: 0 });
```

The [compiled fixtures](tests/compiled) are executable examples for both targets.

Run `npm run demo` and open **http://localhost:4173** for [six focused examples](demo/README.md)
with actual source, response HTML, live DOM and request inspection. The combined
Team desk showcase is available separately at `/combined`.

| Entry                           | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `publr`                         | Authoring intrinsics, effects, reactive objects, named stores and HTML lifecycle |
| `publr/runtime`                 | Internal compiler bindings; shares the same graph as HTML stores                 |
| `publr/dom`                     | Compiler DOM helpers, `mount`, `hydrate`                                         |
| `publr/transport`               | Generated native operation transport                                             |
| `publr/query`                   | Optional dependency invalidation and committed revision delivery                 |
| `publr/router`                  | Matching, URL/history, navigation and explicit view-commit policy                |
| `publr/class-merge`             | Optional class conflict tables and merging                                       |
| `publr/focus`, `publr/position` | DOM lifetime and geometry helpers                                                |

This private workspace resolves authored specifiers with bundler aliases; see
`vite.config.ts`. Generated distributions are ESM files in `dist`. Vendor the
whole output directory so its shared chunks remain available. Use one resolved
copy of this package per application. Importing `publr` starts automatic HTML discovery. It does not install a global `window.Publr`.

For HTML, import the generated `.behavior.js` companion. The companion supplies store actions and reactive values; Publr wires the emitted `data-p-on`, `data-p-text`, `data-p-bind` and named structural ranges. Existing and subsequently inserted HTML activates automatically, without running the DOM component factory. For direct DOM rendering, import the component
and `mount` from `publr/dom`. Each path uses the same compiled component factory.

Local stores also adopt initial state from HTML text, with types inferred from their defaults.

Use `state(initial).value` in plain JavaScript and `createStoreContainer()` for independent applications or server requests.

Named HTML stores remain available to plain JavaScript consumers:

```js
import { createLocalStore } from "publr";
createLocalStore("disclosure", () => ({
  state: { open: false },
  actions: ({ state }) => ({
    toggle: () => {
      state.open = !state.open;
    },
  }),
}));
```

`createStore` uses the intentional browser default; server callers must create an explicit container. `createLocalStore` materializes a store per HTML root. Removed roots retire automatically. The disposer returned by `mount` or compiled `hydrate` retires effects, refs, listeners and children. `reactive` remains a compatibility export; use `state` for new general state.

```sh
npm run verify
```

The full check regenerates browser/native fixtures, executes Zig SSR and endpoint
checks, checks authored types and runtime types/lint, builds, runs runtime tests,
measures complete bundles and runs hydration/focus regressions in Chromium, Firefox and WebKit.
It requires the pinned Zig toolchain and PJSX's development dependencies and installed browsers.
`PJSX_ROOT` overrides the compiler location for fixture generation.

[Measured sizes](docs/bundle-sizes.json) include runtime plus generated component
code, transport where used, compressed sizes, HTML and state payloads. Regression
budgets are pinned in `docs/bundle-budgets.json`. The old distribution baseline is
retained separately; it is not an equivalent application-size comparison.

There are no compatibility adapters for the old generic JSX runtime, query or
mutation APIs, automatic store-family rewriting, or automatic global hydration.
Publr Admin migration, streaming SSR, optimistic mutation reconciliation and
additional async backend targets remain deferred.
