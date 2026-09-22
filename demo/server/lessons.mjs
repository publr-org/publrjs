// The shell teaches one mechanism per document. Source files are served verbatim.
export const lessons = [
  {
    id: "ssr",
    title: "Server HTML → hydration",
    short: "Server rendering",
    action: "Hydrate counter",
    description: "Zig renders a counter. JavaScript adopts the existing DOM when you activate it.",
    initial: "This counter is already in the HTTP response. It starts without event handlers.",
    steps: [
      "Open Response HTML. Find the output containing 0.",
      "Press Hydrate counter, then Increment.",
      "Compare Live DOM: the same output now contains 1.",
    ],
    devtools:
      "Elements: select the output before hydration. Save it as a global variable; after hydration, compare it with the selector below. They are the same node.",
    selector: 'document.querySelector("#example output")',
    files: [
      "SimpleCounter.ptsx",
      "examples/ssr.ts",
      "SimpleCounter.js",
      "SimpleCounter.behavior.js",
      "SimpleCounter.zig",
      "server.zig",
    ],
    takeaway: "HTML existed before JavaScript. Hydration attaches behavior to it.",
  },
  {
    id: "html",
    title: "HTML attributes → state",
    short: "data-p bindings",
    action: "Bind HTML",
    description: "A handwritten HTML counter connects to a local store through data-p attributes.",
    initial: "This counter is plain HTML. Its data-p attributes are present but not active yet.",
    steps: [
      "Read counter.html and html.ts in Source.",
      "Press Bind HTML, then Increment.",
      "Open Live DOM. data-p-text stays; its text changes.",
    ],
    devtools:
      "Elements: inspect this output and its parent’s data-p-store. The button’s data-p-on calls increment in the local store. There is no PTSX component in this example.",
    selector: 'document.querySelector("#example [data-p-text]")',
    files: ["examples/counter.html", "examples/html.ts"],
    takeaway: "data-p binds ordinary HTML to a store. It is independent of SSR.",
  },
  {
    id: "dom",
    title: "PTSX → browser DOM",
    short: "Direct DOM rendering",
    action: "Mount counter",
    description: "The same PTSX counter as example 01, created entirely in the browser.",
    initial: "The server sends an empty #example host. No counter markup is present.",
    steps: [
      "Open Response HTML. The example host is empty.",
      "Press Mount counter, then Increment.",
      "Open Live DOM. The browser has created the counter.",
    ],
    devtools:
      "Elements: inspect #example before and after mounting. In Source, compare SimpleCounter.ptsx with SimpleCounter.js to see the compiler’s DOM helpers.",
    selector: 'document.querySelector("#example")',
    files: ["SimpleCounter.ptsx", "examples/dom.ts", "SimpleCounter.js"],
    takeaway: "mount() creates DOM from a compiled component. No server rendering is involved.",
  },
  {
    id: "async",
    title: "awaited → retained results",
    short: "Async & loading",
    action: "Start async example",
    description:
      "One native operation, an 800 ms delay, and a list that stays visible while its replacement loads.",
    initial: "The list starts with a browser mount and one native request. It uses core awaited.",
    steps: [
      "Press Start. Watch the initial loading fallback.",
      "After the list loads, search Ada. The old list stays during the wait.",
      "Fail next request, then Retry. Inspect both calls in Requests.",
    ],
    devtools:
      "Network: filter /_publr/ and inspect fetchMembers → Payload and Response. Each search calls the Zig function. The pending label and retained list come from core awaited + Loading.",
    selector: 'document.querySelector("#example [aria-busy]")',
    files: ["AsyncExample.ptsx", "examples/async.ts", "AsyncExample.js", "backend/team.zig"],
    takeaway:
      "Core async handles pending, errors and retention. Query caching is the next example.",
  },
  {
    id: "query",
    path: "/learn/query-lab",
    title: "Two readers → one request",
    short: "Query cache",
    action: "Start Query example",
    description: "Two awaited values read the same Query cache key and share the native request.",
    initial:
      "Both readers mount together. Query supplies cache identity; awaited supplies their loading behavior.",
    steps: [
      "Open Requests, then press Start Query example.",
      "Two readers resolve from exactly one fetchMembers call.",
      "Press Invalidate people. Both refresh through one additional call.",
    ],
    devtools:
      "Network: filter /_publr/. Count one call on mount and one more on invalidation. In Source, both cache.read calls use the team key. TTL is checked on reads; it is not a polling timer.",
    selector: 'document.querySelector("#example .readers")',
    files: [
      "QueryExample.ptsx",
      "examples/query.ts",
      "QueryExample.js",
      "Desk.ptsx",
      "backend/team.zig",
    ],
    takeaway: "Query adds key-based sharing, TTL and tag invalidation to core async.",
  },
  {
    id: "navigation",
    path: "/learn/navigation/a",
    title: "SPA link vs document link",
    short: "Navigation",
    action: "Start router",
    description:
      "The two rows point to the same URLs. Only one row is intercepted by Publr’s router.",
    initial: "The server renders this page label. Start the router before testing the SPA row.",
    steps: [
      "Start router and type a draft. Note the document ID.",
      "Click Page B in the SPA row. Your draft and document ID stay.",
      "Click Page A in Full document. The draft resets and the ID changes.",
    ],
    devtools:
      'Network: enable Preserve log and filter Doc. SPA links produce no document request. Full document links do. Elements: the second row opts out with data-p-router="off".',
    selector: 'document.querySelector("#example [data-p-router]")',
    files: ["NavigationPage.ptsx", "examples/navigation.ts", "NavigationPage.zig", "server.zig"],
    takeaway:
      "Navigation policy is separate from rendering: both link rows target server-renderable pages.",
  },
];
export const lessonPath = (lesson) => lesson.path ?? `/learn/${lesson.id}`;
export const sourceFiles = new Set(lessons.flatMap((lesson) => lesson.files));
export function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function lessonMarkup(template, lesson, example, documentID, pathname) {
  const index = lessons.indexOf(lesson);
  const next = lessons[index + 1];
  const fields = {
    TITLE: escapeHTML(lesson.title),
    LESSON: lesson.id,
    NUMBER: String(index + 1).padStart(2, "0"),
    DESCRIPTION: escapeHTML(lesson.description),
    INITIAL: escapeHTML(lesson.initial),
    ACTION: lesson.action,
    DEVTOOLS: escapeHTML(lesson.devtools),
    SELECTOR: escapeHTML(lesson.selector),
    TAKEAWAY: escapeHTML(lesson.takeaway),
    EXAMPLE: example,
    "RESPONSE-JSON": JSON.stringify(example).replaceAll("<", "\\u003c"),
    "DOCUMENT-ID": documentID,
    RESET: escapeHTML(pathname),
    "NEXT-URL": next ? lessonPath(next) : "/combined",
    "NEXT-LABEL": next ? `Next: ${next.short}` : "Open combined demo",
    NAV: lessons
      .map(
        (item, number) =>
          `<a href="${lessonPath(item)}" ${item === lesson ? 'aria-current="page"' : ""}><span>${String(number + 1).padStart(2, "0")}</span>${item.short}</a>`,
      )
      .join(""),
    STEPS: lesson.steps.map((step) => `<li>${escapeHTML(step)}</li>`).join(""),
    FILES: lesson.files.map((file) => `<option value="${file}">${file}</option>`).join(""),
  };
  return template.replace(/<!--([A-Z-]+)-->/g, (match, key) => fields[key] ?? match);
}
