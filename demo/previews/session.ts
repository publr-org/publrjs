import { activate, destroy } from "publr";
import { mount } from "publr/dom";
import type { LessonOptions } from "../chapters/types";

export function observePreview(host: HTMLElement, update: (html: string) => void) {
  const refresh = () => update(host.innerHTML);
  const observer = new MutationObserver(refresh);
  observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
  refresh();
  return () => observer.disconnect();
}
export function nativePreview(
  host: HTMLElement,
  html: string,
  server: boolean,
  options: LessonOptions,
  update: (html: string) => void,
) {
  // This is the rendering boundary for the actual lesson response, never harness UI.
  const response = new DOMParser().parseFromString(html, "text/html");
  host.replaceChildren(...Array.from(response.body.childNodes));
  const unobserve = observePreview(host, update);
  let stop: (() => void) | undefined;
  return {
    ready: Promise.resolve(),
    start() {
      if (stop) return;
      if (server) {
        if (!options.renderOnly) activate(host);
        stop = () => destroy(host);
      } else {
        if (!options.Component) throw new Error("A browser-rendered preview requires a component.");
        stop = mount(host.querySelector<HTMLElement>("#app") ?? host, options.Component);
      }
    },
    dispose() {
      unobserve();
      stop?.();
      destroy(host);
    },
  };
}
export function isolatedKind(options: LessonOptions) {
  return options.portalLesson
    ? options.portalLesson.focus
      ? "focus"
      : options.portalLesson.position
        ? "position"
        : "portals"
    : options.awaitedLesson
      ? options.awaitedLesson.query
        ? "query"
        : options.awaitedLesson.failure
          ? "failure"
          : "awaited"
      : "effects";
}
export function isolatedSession(
  frame: HTMLIFrameElement,
  html: string,
  server: boolean,
  options: LessonOptions,
  controlled: boolean,
  update: (html: string) => void,
) {
  const kind = isolatedKind(options);
  const portal = !!options.portalLesson;
  const id = crypto.randomUUID();
  let disposed = false;
  let stopWatching = () => {};
  let observer: MutationObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let resolveReady = () => {};
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  const loaded = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || disposed)
      return;
    if (event.data?.type !== (portal ? "publr:portal:loaded" : "publr:awaited:loaded")) return;
    if (!portal && event.data.id !== id) return;
    const doc = frame.contentDocument!;
    const app = doc.getElementById("preview")!;
    const refresh = () => {
      if (disposed) return;
      const root = doc.getElementById("publr-portal");
      update(portal ? app.outerHTML + (root ? "\n" + root.outerHTML : "") : app.innerHTML);
      if (portal || kind === "query") {
        const panel = root?.querySelector<HTMLElement>(".portal-panel");
        const height = Math.ceil(
          Math.max(
            doc.body.getBoundingClientRect().height,
            kind === "portals" && panel ? panel.getBoundingClientRect().bottom + 12 : 0,
          ),
        );
        if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
      }
    };
    observer = new MutationObserver(refresh);
    observer.observe(portal ? doc.body : app, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(doc.body);
    refresh();
    resolveReady();
    window.removeEventListener("message", loaded);
  };
  const onload = () => {
    if (disposed) return;
    if (options.effectLesson) {
      const app = frame.contentDocument?.getElementById("preview");
      if (app) stopWatching = observePreview(app, update);
      resolveReady();
    } else
      frame.contentWindow?.postMessage(
        {
          type: portal ? "publr:portal:setup" : "publr:awaited:setup",
          html,
          server,
          active: false,
          controlled,
        },
        location.origin,
      );
  };
  window.addEventListener("message", loaded);
  frame.addEventListener("load", onload, { once: true });
  if (options.effectLesson)
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Counter</title><link rel="stylesheet" href="/introduction.css"><link rel="stylesheet" href="/effects-frame.css"><script src="/theme-init.js"></script><link rel="stylesheet" href="/theme.css"></head><body data-start="false"><div class="effect-tab">Tab · <span id="tab-title">Counter</span></div><div id="preview" data-p-activation="manual">${html}</div><script type="module" src="/effects-frame.js"></script></body></html>`;
  else
    frame.src =
      `/learn/${kind}/frame` + (portal ? "" : `?id=${id}&controlled=${controlled ? "1" : "0"}`);
  return {
    ready,
    start() {
      void ready.then(() => {
        if (!disposed)
          frame.contentWindow?.postMessage(
            options.effectLesson
              ? "publr:start-effect-demo"
              : { type: portal ? "publr:portal:start" : "publr:awaited:start" },
            location.origin,
          );
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resolveReady();
      observer?.disconnect();
      resizeObserver?.disconnect();
      stopWatching();
      window.removeEventListener("message", loaded);
      frame.removeEventListener("load", onload);
      if (portal) frame.contentWindow?.dispatchEvent(new Event("publr:portal:dispose"));
      else if (!options.effectLesson)
        void fetch(`/learn/${kind}/control?id=${id}&action=dispose`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
    },
  };
}
