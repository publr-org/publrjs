import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function awaitedContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, awaitedLesson } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term("awaited", "A result that follows its inputs. Changing search starts a new request."),
      " tracks findPeople(search). ",
      term(
        "Loading",
        "Shows a fallback before the first result. During later requests, it keeps the previous result visible.",
      ),
      " handles the wait.",
    );
    if (awaitedLesson!.failure) {
      description.parts = [
        term(
          "isError",
          "True when the latest read failed. A previous result can still be visible.",
        ),
        " shows Retry. ",
        term(
          "error",
          "The latest failure. Native requests return an Error whose message can be displayed.",
        ),
        " supplies its message. ",
        term("refresh", "Runs the same read again with its current inputs."),
        " retries people. A superseded request cannot replace the latest search result.",
      ];
    }
    if (awaitedLesson!.query) {
      description.parts = [
        "Both PeopleReader instances call the same operation with the same search. ",
        term(
          "cache",
          "Shares in-flight work and reuses a fresh result for the same operation and arguments.",
        ),
        " gives them one browser request. ",
        term(
          "ttl",
          "Freshness duration in milliseconds. It is checked on reads, not by an automatic refresh timer.",
        ),
        " is 60 seconds. ",
        term("invalidate", "Marks matching tagged results stale and refreshes active readers."),
        " runs inside savePerson after the server saves. Both readers tagged people then fetch the new server list. ",
        term(
          "mutation",
          "An action with reactive pending, error, and result state. Call the action to perform the write.",
        ),
        " supplies the saving and error state.",
      ];
      return [
        description,
        fileTabs(
          awaitedLesson!.files!.map((file) => ({
            name: file.name,
            card: stateCode(file.name, file.source.trim()),
          })),
        ),
      ];
    }
    return [
      description,
      stateCode(
        awaitedLesson!.failure ? "ResilientSearch.ptsx" : "PeopleSearch.ptsx",
        source.trim(),
      ),
    ];
  }
  description.parts = [
    "The HTML template describes the bindings. The store connects search to awaited; request.js calls the API.",
  ];
  const explanation = paragraph(
    "updateSearch sets state.search. awaited tracks that read and requests people again when search changes. The result owns its loading state and retains its previous value while waiting.",
  );
  if (awaitedLesson!.failure)
    explanation.parts = [
      "Retry calls the public awaited value’s refresh() method. The error stays outside the retained list. Changing search supersedes the previous read; an obsolete result cannot replace the current one.",
    ];
  if (awaitedLesson!.query) {
    description.parts = [
      "This public HTML equivalent keeps two awaited readers in one local store. Both use the same key and freshness policy. The Demo inspector shows the compiler’s component stores.",
    ];
    explanation.parts = [
      "The native operation and search form the cache identity. Handwritten callbacks supply that key explicitly. savePerson writes to the server first. Only a successful write invalidates people, so both readers share one new query. The new row comes from that query response.",
    ];
  }
  const note = paragraph(
    "This is the public data-p form of the example. In the Demo step, Show code reveals the actual HTML in that preview as it loads and updates.",
  );
  const files = [
    { name: "HTML", card: stateCode("HTML template", awaitedLesson!.publicHTML.trim()) },
    {
      name: "stores.js",
      card: stateCode("Generated store setup", awaitedLesson!.storeSource.trim()),
    },
    {
      name: "request.js",
      card: stateCode("Generated API request", awaitedLesson!.requestSource),
    },
  ];
  if (!server) {
    description.parts = [
      "JavaScript creates DOM nodes and attaches event handlers directly. This public equivalent uses the same DOM operations with reactive state and awaited.",
    ];
    return [
      description,
      fileTabs([
        {
          name: awaitedLesson!.query
            ? "SharedPeople.js"
            : awaitedLesson!.failure
              ? "ResilientSearch.js"
              : "PeopleSearch.js",
          card: stateCode("JavaScript DOM setup", awaitedLesson!.publicDOM.trim()),
        },
        {
          name: "request.js",
          card: stateCode("Generated API request", awaitedLesson!.requestSource),
        },
      ]),
    ];
  }
  return [description, explanation, fileTabs(files), note];
}
