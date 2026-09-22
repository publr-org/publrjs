# Publr examples

```sh
npm run demo
```

Open **http://localhost:4173**. The root opens the first of six isolated examples.
The lesson shell deliberately delays loading its selected behavior until activation. Normal application assets activate server HTML automatically; the combined example demonstrates that startup.

| Page                  | Experiment                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `/` or `/learn/ssr`   | Zig-rendered counter; load behavior and let automatic activation preserve its original DOM node. |
| `/learn/html`         | Handwritten HTML, `data-p` attributes, and a local store.                                        |
| `/learn/dom`          | The same PTSX counter, mounted into an empty browser host.                                       |
| `/learn/async`        | One native async dependency; initial loading, retained results, failure and retry.               |
| `/learn/query-lab`    | Two cache readers, one shared request, and tag invalidation.                                     |
| `/learn/navigation/a` | SPA and full-document links targeting the same native-rendered pages.                            |

Every example has three concrete steps, a small running UI, and an inspector:

- **Source** reads the actual authored, entry, backend and generated files. The
  file selector switches between them; Open file opens the complete source.
- **Response HTML** shows the exact example fragment inserted by the server,
  serialized separately before the browser parses or activates it.
- **Live DOM** observes the example host and updates when its DOM changes.
- **Requests** records only native `/_publr/` operations, with method, URL,
  payload, response, status and elapsed time. It excludes inspection-source
  requests, assets and document navigation. Use DevTools Network → Doc to
  inspect the latter.

The DevTools recipe on each page gives a specific panel, selector and expected
observation. The browser bundle is readable and includes source maps. Example
entry modules are lazy-loaded on activation; browsing one page does not mount
other examples or start their requests. The shell is authored in `app/pages/LearnPage.ptsx`;
`app/components/FocusedInspector.ptsx` owns its inspector and activation controls.

The first and third examples compile the same `SimpleCounter.ptsx`. The HTML
example deliberately uses `examples/counter.html` and `examples/html.ts` instead.
The navigation template is `NavigationPage.ptsx`, rendered by Zig on every full
page request. Its plain JavaScript router entry only changes the heading during
SPA navigation, leaving the draft input mounted.

The full **Team desk** lives separately at `/combined`, with its lab at
`/combined/lab`. It combines native SSR/hydration, chained async dependencies,
keyed notes and stars, HTML/shared stores, derived values, snapshots, effects,
owner disposal, Query, router, portal, positioning and focus helpers. The
combined directory stays mounted across its two tabs. Its Client mount button
replaces just the directory; Native SSR reloads the document.

`build.mjs` builds PJSX, native templates and operation dispatch, backend types,
and browser entry modules. `server/serve.mjs` is a small local Node host that invokes
the native executable per request and serves an explicit allowlist of teaching
source files. It is not a production hosting adapter. Set `PORT` to choose a port.

After editing PTSX, TypeScript or Zig, rebuild with `npm run demo:build`. Restart
`node demo/server/serve.mjs` after changing server code or lesson descriptions. PTSX pages are prerendered and component styles are bundled during the build.

While the server is running:

```sh
npm run demo:test
```

Tests cover all six focused experiments, real source inspection, keyboard tabs,
mobile layout, and the combined demo's async, identity and lifecycle behavior.

## Progressive tutorial

The approved tutorial starts at `/learn/introduction`. The end of Reuse is
`/learn/reuse`; its Next link opens `/learn/awaited` (07 · Awaited data).
The new chapter uses a real native people API with an 800 ms response delay.
Walkthroughs can pause and release responses independently with Respond now.
Its Next link opens `/learn/failure` (08 · Failure and consistency), which adds
one-shot failure and slow-response controls, retry, and superseded searches.
Next is `/learn/query` (09 · Query): two PeopleReader instances share requests,
reuse fresh results, and add a person on the server before invalidating the people tag. The older focused Query
experiment remains at `/learn/query-lab`. These chapters share the isolated
preview lifecycle and live HTML inspection.
See `../docs/tutorial-progress.md` for chapter status and validation coverage.

Query links to `/learn/portals` (10 · Portals): a details panel escapes its clipping
container while its actions continue to update the original component. The live
inspector includes the portal root, with independent pages for every preview.

Portals links to `/learn/position` (11 · Position), using the existing anchor and
position directives. Scroll the scene or move its trigger to observe following,
vertical flipping, and alignment changes at the viewport edges.

## File organization

The demo is a multipage application. The tutorial harness, focused inspector,
combined application, sharing guide, sidebar, and theme toggle are authored in
PTSX and compiled with the same compiler used by the teaching examples.

| Folder                                                   | Responsibility                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `app/components/`                                        | PTSX UI: dialogs, debugger, tabs, inspectors, previews, and application controls.  |
| `app/pages/`                                             | Document shells and chapter page exports using one shared layout.                  |
| `app/walkthrough/`                                       | Tutorial session, file-tab state, content model, and MPA mounting boundary.        |
| `app/code/`, `app/theme/`                                | Shared syntax tokens, HTML formatting, and theme initialization.                   |
| `app/focused/`, `app/combined/`                          | Small browser entries for the standalone experiments.                              |
| `chapters/entries/`                                      | Teaching component imports and chapter configuration.                              |
| `chapters/content/`, `chapters/snippets/`                | Explanations, source examples, and readable generated-code presentations.          |
| `chapters/catalog.ts`, `chapters/navigation.ts`          | Route metadata and navigation.                                                     |
| `examples/components/`, `examples/state/`                | The actual PTSX teaching examples and shared stores.                               |
| `previews/`                                              | Isolated documents and adapters for real sample rendering and requests.            |
| `styles/chapter/`, `styles/focused/`, `styles/combined/` | Styles grouped by UI responsibility; public entry stylesheets only import modules. |
| `server/`, `native/`, `backend/`                         | Current HTTP host, native rendering, request controls, and Zig operations.         |
| `tests/`                                                 | Browser and server regression checks.                                              |
| `.generated/`, `dist/`, `zig-out/`                       | Disposable compiler output, browser/CSS bundles, and native executable.            |

The app components own reactive UI state and lifecycle. TypeScript adapters are
limited to mounting boundaries, reading real preview responses, observing the
sample DOM, and communicating with isolated preview documents. Chapter content
is data; it does not construct DOM nodes.

`build.mjs` compiles the PTSX, renders document shells, bundles browser modules and
styles, and restores the preceding output if a build fails. The server inserts
the actual Zig preview response into each document, so server previews remain
available without JavaScript. The HTTP host is still `server/serve.mjs`; migration
to `lib/http` remains outstanding.

The theme button follows the system preference until a theme is chosen, persists
the choice, and synchronizes open tabs and preview frames. A small head script
applies the theme before paint. Generated code uses shared stripes in both themes.
