import { mount } from "publr/dom";
import { destroy } from "publr";
import { tutorialSession } from "./session";
import type { LessonOptions } from "../../chapters/types";
// @ts-ignore Compiled from the PTSX components in this app.
import * as Tutorial from "../../.generated/app/components/TutorialHarness.js";
export type { LessonOptions } from "../../chapters/types";

// MPA enhancement boundary: server HTML stays useful without JavaScript. Each
// interactive island is a compiled PTSX component with Publr-owned state/lifecycle.
export function setupWalkthrough(options: LessonOptions) {
  const session = tutorialSession(options);
  const server = document.getElementById("server-result")!;
  const browser = document.getElementById("browser-result")!;
  let html = server.innerHTML;
  const shell = document.getElementById("tutorial-dialogs")!;
  const disposals = [mount(shell, Tutorial.TutorialHarness, { session })];
  for (const target of ["zig", "javascript"]) {
    const host = document.querySelector<HTMLElement>(`[data-walkthrough-host="${target}"]`)!;
    host.replaceChildren();
    disposals.push(mount(host, Tutorial.WalkthroughLaunch, { session, server: target === "zig" }));
  }
  const compareHost = document.getElementById("compare-open")!.parentElement!;
  compareHost.replaceChildren();
  disposals.push(mount(compareHost, Tutorial.CompareLaunch, { session }));
  const source = document.querySelector<HTMLElement>(".source");
  if (source) {
    const filename = source.querySelector("h2")?.textContent ?? "PTSX";
    const files =
      options.awaitedLesson?.files ??
      (options.reuseLesson
        ? [
            { name: "ReuseDemo.ptsx", source: options.source },
            { name: "InstanceCounter.ptsx", source: options.reuseLesson.childSource },
          ]
        : options.compositionLesson
          ? [
              { name: "StaticPage.ptsx", source: options.source },
              { name: "StaticGreeting.ptsx", source: options.compositionLesson.childSource },
            ]
          : options.propsLesson
            ? [
                { name: "PropsDemo.ptsx", source: options.source },
                { name: "Greeting.ptsx", source: options.propsLesson.childSource },
              ]
            : options.cleanupLesson
              ? [
                  { name: "TimerDemo.ptsx", source: options.source },
                  { name: "Timer.ptsx", source: options.cleanupLesson.timerSource },
                ]
              : [{ name: filename, source: options.source }]);
    source.replaceChildren();
    disposals.push(mount(source, Tutorial.SourcePanel, { filename, files }));
  }
  let stopPreviews = () => {};
  function previews() {
    stopPreviews();
    destroy(server);
    server.replaceChildren();
    browser.replaceChildren();
    const stopServer = mount(server, Tutorial.MainPreview, { session, server: true, html });
    const stopBrowser = mount(browser, Tutorial.MainPreview, {
      session,
      server: false,
      html: '<div id="app"></div>',
    });
    stopPreviews = () => {
      stopServer();
      stopBrowser();
    };
  }
  previews();
  window.addEventListener(
    "pagehide",
    () => {
      stopPreviews();
      disposals.forEach((stop) => stop());
    },
    { once: true },
  );
  return {
    session,
    setLesson(next: LessonOptions, markup: string) {
      session.options = next;
      session.presentation = tutorialSession(next).presentation;
      html = markup;
      previews();
    },
  };
}
