import type { ContentContext } from "../../app/walkthrough/content";

export function stateTitle(ctx: ContentContext, sourceStep: boolean, server: boolean) {
  const {
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
  } = ctx;
  if (portalLesson?.focus)
    return sourceStep
      ? "Keep focus in the dialog."
      : server
        ? "HTML + JavaScript."
        : "Focus in. Focus back.";
  if (portalLesson?.position)
    return sourceStep
      ? "Keep it by the button."
      : server
        ? "HTML + JavaScript."
        : "Let Publr position the panel.";
  if (portalLesson)
    return sourceStep
      ? "Outside the box. Still connected."
      : server
        ? "HTML + JavaScript."
        : "Move the panel. Keep the connection.";
  if (sourceStep)
    return awaitedLesson
      ? awaitedLesson.query
        ? "Two readers. One request."
        : awaitedLesson.failure
          ? "Recover from a failed request."
          : "Keep the result while you wait."
      : reuseLesson
        ? "Same component. Separate state."
        : propsLesson
          ? "Pass it to a child."
          : cleanupLesson
            ? "Stop when it leaves."
            : refLesson
              ? "Reach the actual element."
              : switchLesson
                ? "One match at a time."
                : inputLesson
                  ? "Type it. See it change."
                  : listLesson
                    ? "One item. One row."
                    : conditionalLesson
                      ? "Show it when you need it."
                      : effectLesson
                        ? "Keep the tab title in sync."
                        : derivedLesson
                          ? "One value follows another."
                          : "A value that changes.";
  return server
    ? "HTML + JavaScript."
    : awaitedLesson
      ? "Request people from the API."
      : propsLesson
        ? "JavaScript connects the child."
        : cleanupLesson
          ? "JavaScript owns the timer."
          : refLesson
            ? "JavaScript connects the reference."
            : switchLesson
              ? "JavaScript selects the message."
              : inputLesson
                ? "JavaScript connects the input."
                : listLesson
                  ? "JavaScript creates the list."
                  : conditionalLesson
                    ? "JavaScript creates the message."
                    : "JavaScript creates the counter.";
}
