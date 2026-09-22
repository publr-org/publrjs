<div align="center">

# PublrJS

**The browser runtime behind Publr. Compiled components, native hydration, and one reactive graph shared by HTML and JavaScript.**

</div>

---

PublrJS is what a PTSX component becomes in the browser. The
[pjsx](https://github.com/publr-org/pjsx) compiler lowers a component to calls
on this runtime: specialized DOM writes, keyed regions, native operation
transport and a hydration companion for the HTML the server already rendered.
There is no virtual DOM and no diffing. A reactive value drives exactly the
attribute, text node or region that reads it.

```tsx
import { state, derived, effect } from "publr";

export function Counter(props: { initial: number }) {
  let count = state(props.initial);
  const doubled = derived(() => count * 2);
  effect(() => console.log(count, doubled));
  return (
    <button onClick={() => count++}>
      {count} / {doubled}
    </button>
  );
}
```

```sh
cd ../pjsx && zig build
zig-out/bin/pjsx dom ../publr-js/tests/compiled/Counter.ptsx --out ../publr-js/tests/compiled
```

```js
import { mount } from "publr/dom";
import { Counter } from "./Counter.js";
const dispose = mount(document.querySelector("#app"), Counter, { initial: 0 });
```

## Why

- **Authored values, compiled bindings.** A component reads and assigns
  ordinary variables. The compiler turns each read into a graph binding and
  each JSX expression into the one DOM write it needs.
- **Server HTML is the first render.** The Zig target renders the same
  component as static HTML with `data-p-*` markers. Importing the generated
  `.behavior.js` companion activates that HTML in place, keeping every node,
  its focus and its draft text. No second render, no duplicate fetch.
- **One graph for both worlds.** Compiled components, handwritten
  `data-p-*` markup and plain JavaScript stores read and write the same
  reactive values. A named HTML store and a mounted component can share state
  without a framework boundary between them.
- **Async is a value.** `awaited(op())` is a pending, failed or ready value
  that a region renders through `Loading`. Results are retained across
  retries, deduplicated across readers by the query addon, and delivered as
  committed revisions.
- **Small, per page.** A counter ships in about 5 KB gzipped, runtime and
  component together. Each addon is its own entry and a page only loads what
  its components use.

## Entries

| Entry                           | Purpose                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `publr`                         | Authoring intrinsics, effects, reactive objects, named stores and HTML lifecycle     |
| `publr/dom`                     | The compiler's DOM target: element factories, regions, `mount`, `hydrate`            |
| `publr-jsx`                     | The authoring face over the DOM target: `Dynamic`, `Slot`, `initials`, `gravatarUrl` |
| `publr/runtime`                 | Internal compiler bindings, on the same graph as HTML stores                         |
| `publr/transport`               | Generated native operation transport                                                 |
| `publr/query`                   | Dependency invalidation, shared requests and committed revision delivery             |
| `publr/router`                  | Matching, URL and history, navigation and explicit view commit                       |
| `publr/class-merge`             | Class conflict tables and merging, the same rules as the server                      |
| `publr/focus`, `publr/position` | DOM lifetime and geometry helpers                                                    |

Generated distributions are ES modules in `dist`, built by `npm run build`.
Vendor the whole directory so the shared chunks stay beside the entries, and
resolve one copy of the package per application. Importing `publr` starts
automatic HTML discovery; it installs no global.

## Two ways in

**Server-rendered HTML.** Import the component's generated `.behavior.js`
companion. It registers the store's actions and values; the runtime wires the
emitted `data-p-on`, `data-p-text`, `data-p-bind` attributes and the named
structural ranges. HTML present at load and HTML inserted later both activate,
without running the DOM factory.

**Direct DOM.** Import the component and `mount` from `publr/dom`. The same
compiled factory builds the tree in the browser. `hydrate` adopts an existing
server-rendered root instead of creating nodes.

Named stores stay reachable from plain JavaScript:

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

`createStore` makes one shared store for the page. `createLocalStore`
materializes a store per HTML root and retires it when the root is removed.
On the server, `createStoreContainer()` gives every request its own graph.
A local store adopts the initial text of a direct `data-p-text` binding, typed
by its default.

## Examples

```sh
npm run demo
```

Opens the lessons at **http://localhost:4173**: server rendering
without JavaScript, hydration that keeps DOM identity, direct mounting, async
values with retry, query sharing and invalidation, portals, positioning,
focus, routing and shared state. Every lesson shows the authored source, the
exact response HTML, the live DOM and the native requests it makes. See
[demo/README.md](demo/README.md).

## Layout

```
src/publr.ts           the `publr` entry and the Publr runtime object
src/addons/dom.ts      the DOM target
src/addons/jsx.ts      publr-jsx
src/addons/            query, router, class-merge, focus, position
src/core/              the graph, regions, directives, stores, transfer
src/html.ts            HTML discovery and the data-p wire
tests/                 the unit suite (vitest, happy-dom)
tests/compiled/        PTSX fixtures compiled to DOM, HTML and Zig, with native tests
tests/html/            the HTML companion fixtures
demo/                  the lessons: chapters, examples, a Zig backend and browser tests
scripts/               fixture compilation, bundle measurement and browser checks
```

## Verify

```sh
npm test               # the unit suite
npm run verify         # everything below
```

`verify` recompiles the fixtures with pjsx, type-checks the authored PTSX,
lints and type-checks the runtime, builds, runs the unit suite, measures the
bundles against `docs/bundle-budgets.json`, and runs the hydration, focus and
prerequisite checks in Chromium, Firefox and WebKit. The Zig fixture suites run
with `zig build test` in `tests/compiled` and `tests/html`. `PJSX_ROOT` points
fixture compilation at another compiler checkout.

## Part of Publr

| Repository                                  | What it is                                          |
| ------------------------------------------- | --------------------------------------------------- |
| [publr](https://github.com/publr-org/publr) | the CMS, one binary                                 |
| [pjsx](https://github.com/publr-org/pjsx)   | the PTSX compiler: DOM and Zig targets              |
| [ui](https://github.com/publr-org/ui)       | the design system, one PTSX source for both targets |
| [icons](https://github.com/publr-org/icons) | the icon set and its generated adapters             |
| [jit](https://github.com/publr-org/jit)     | classes to CSS, at build time or in the browser     |
| [lib](https://github.com/publr-org/lib)     | the Zig libraries: sqlite, http, auth, deps         |

## License

[Apache 2.0](LICENSE)
