import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, inlineCode, term, fileTabs } from "../../app/walkthrough/content";
import { awaitedContent } from "./awaited";
import { reuseContent } from "./reuse";
import { propsContent } from "./props";
import { cleanupContent } from "./cleanup";
import { refContent } from "./ref";
import { switchContent } from "./switch";
import { inputContent } from "./input";
import { listContent } from "./list";
import { conditionalContent } from "./conditional";
import { effectContent } from "./effect";
import { derivedContent } from "./derived";

export function stateContent(ctx: ContentContext, index: number, server: boolean) {
  const {
    source,
    awaitedLesson,
    portalLesson,
    reuseLesson,
    propsLesson,
    cleanupLesson,
    refLesson,
    switchLesson,
    inputLesson,
    listLesson,
    conditionalLesson,
    effectLesson,
    derivedLesson,
    stateDOM,
  } = ctx;
  const stateCode = ctx.stateCode;
  if (portalLesson?.focus) {
    const description = paragraph();
    if (index === 0) {
      description.parts.push(
        term(
          "trapFocus",
          "Focuses the first dialog control and wraps Tab and Shift+Tab inside. Its cleanup releases the trap and restores focus.",
        ),
        " runs in an effect when open becomes true. Closing runs the cleanup. ",
        term(
          "inert",
          "Prevents focus and interaction within the background card while the dialog is open.",
        ),
        " makes the background card unavailable while the dialog is open.",
      );
      return [description, stateCode("FocusDetails.ptsx", source.trim())];
    }
    description.parts = [
      "Refs connect the trigger and dialog. The effect starts trapFocus after the DOM updates and releases it on close or cleanup. The defaults focus the first control on open and restore the previously focused element on close. The separate position binding supplies the dismiss event for Escape; closeDetails changes open.",
    ];
    return [
      description,
      server
        ? fileTabs([
            { name: "HTML", card: stateCode("HTML template", portalLesson.publicHTML.trim()) },
            {
              name: "stores.js",
              card: stateCode("Generated store setup", portalLesson.storeSource.trim()),
            },
          ])
        : stateCode("JavaScript DOM setup", portalLesson.publicDOM.trim()),
    ];
  }
  if (portalLesson?.position) {
    const description = paragraph();
    if (index === 0) {
      description.parts.push(
        term("ref", "Connects the trigger element to the panel’s anchor option."),
        " identifies the button. ",
        term(
          "position",
          "Uses Publr’s existing position extension. The options name an anchor ref, a placement, and a gap. It flips or shifts when space runs out.",
        ),
        " receives that ref as anchor. The bottom-start placement aligns the panel below the button. The offset leaves an 8 px gap.",
      );
      return [description, stateCode("AnchoredDetails.ptsx", source.trim())];
    }
    description.parts = [
      server
        ? "The trigger ref and position binding connect Publr’s existing positioning behavior. It updates on scroll, resize, and opening. The separate portal option keeps the panel outside the scrolling container. Position also works without a portal."
        : "This public DOM equivalent creates the same data-p directives. hydrate connects their existing positioning and portal behavior; destroy removes their listeners during cleanup.",
    ];
    return [
      description,
      server
        ? fileTabs([
            { name: "HTML", card: stateCode("HTML template", portalLesson.publicHTML.trim()) },
            {
              name: "stores.js",
              card: stateCode("Generated store setup", portalLesson.storeSource.trim()),
            },
          ])
        : stateCode("JavaScript DOM setup", portalLesson.publicDOM.trim()),
    ];
  }
  if (portalLesson) {
    const description = paragraph();
    if (index === 0) {
      description.parts.push(
        term(
          "portal",
          "Moves this element to a root under the document body, outside its original container. Its state and events remain connected.",
        ),
        " lets the details panel escape overflow: hidden. The panel starts hidden; Open details reveals it.",
      );
      return [description, stateCode("PersonDetails.ptsx", source.trim())];
    }
    description.parts = [
      server
        ? "The HTML equivalent uses data-p-portal. During setup, Publr moves the same panel to #publr-portal and keeps its actions connected to PersonDetails. hidden follows open. CSS places the panel."
        : "The browser creates the panel, then portal moves it outside the container. Its callbacks still update the same state. The effect restores its location during cleanup. CSS places the panel.",
    ];
    return [
      description,
      server
        ? fileTabs([
            { name: "HTML", card: stateCode("HTML template", portalLesson.publicHTML.trim()) },
            {
              name: "stores.js",
              card: stateCode("Generated store setup", portalLesson.storeSource.trim()),
            },
          ])
        : stateCode("JavaScript DOM setup", portalLesson.publicDOM.trim()),
    ];
  }
  if (awaitedLesson) return awaitedContent(ctx, index, server);
  if (reuseLesson) return reuseContent(ctx, index, server);
  if (propsLesson) return propsContent(ctx, index, server);
  if (cleanupLesson) return cleanupContent(ctx, index, server);
  if (refLesson) return refContent(ctx, index, server);
  if (switchLesson) return switchContent(ctx, index, server);
  if (inputLesson) return inputContent(ctx, index, server);
  if (listLesson) return listContent(ctx, index, server);
  if (conditionalLesson) return conditionalContent(ctx, index, server);
  if (effectLesson) return effectContent(ctx, index, server);
  if (derivedLesson) return derivedContent(ctx, index, server);
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term(
        "State",
        "A value the page remembers. When it changes, Publr updates the places that display it.",
      ),
      " starts count at 0. Increment adds 1.",
    );
    return [description, stateCode("StateCounter.ptsx", source.trim())];
  }
  if (server) {
    description.parts.push(
      "The button calls increment. ",
      inlineCode("data-p-text"),
      " keeps the number connected to count.",
    );
    return [
      description,
      stateCode(
        "HTML",
        '<div data-p-store="Counter">\n  <output data-p-text="$count">0</output>\n  <button data-p-on="click:increment">Increment</button>\n</div>',
      ),
      stateCode(
        "JavaScript · store setup",
        'createLocalStore("Counter", () => ({\n  state: { count: 0 },\n  actions: ({ state }) => ({\n    increment() { state.count++; }\n  })\n}));',
      ),
    ];
  }
  description.parts.push("Publr watches count.read() and updates the number when count changes.");
  const stateStart = stateDOM.indexOf("let count");
  const stateEnd = stateDOM.indexOf("publr.captureActions");
  const stateExcerpt = stateDOM.slice(stateStart, stateEnd).trim().replace(/^  /gm, "");
  const display = stateDOM.match(/dom\.insert\(\(\) => count\.read\(\)\)/)![0];
  const event = stateDOM.match(/dom\.event\(element, "click", increment\);/)![0];
  return [
    description,
    stateCode("Generated JavaScript · state + action", stateExcerpt),
    stateCode("Generated JavaScript · output content", display),
    stateCode("Generated JavaScript · button click", event.replace("element,", "button,")),
  ];
}
