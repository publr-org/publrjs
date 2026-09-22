import { activate, destroy } from "publr";
import { mount } from "publr/dom";
import { observeOperations } from "publr/transport";

export function setupPeopleFrame(
  Component: () => HTMLElement,
  lesson: "awaited" | "failure" | "query" = "awaited",
) {
  const failure = lesson === "failure";
  const host = document.getElementById("preview")!;
  const controls = document.getElementById("api-controls")!;
  const pause = document.getElementById("pause-response") as HTMLInputElement;
  const respond = document.getElementById("respond-now") as HTMLButtonElement;
  const status = document.getElementById("api-status")!;
  const id = new URL(location.href).searchParams.get("id")!;
  let pending = 0;
  let requests = 0;
  let outcome = "response received";
  let superseded = 0;
  let latestPending = false;
  let stop: (() => void) | undefined;
  let server = false;
  let disposed = false;
  const control = (action: string) =>
    fetch(`/learn/${lesson}/control?id=${encodeURIComponent(id)}&action=${action}`, {
      method: "POST",
    });
  function updateStatus() {
    respond.disabled = pending === 0;
    status.textContent = latestPending
      ? `Request ${requests} · ${pause.checked ? "response paused" : "800 ms delay"}`
      : requests
        ? `Request ${requests} · ${outcome}${failure && superseded ? " · earlier search superseded" : ""}`
        : "No browser request yet";
    if (lesson === "query")
      status.textContent = `Browser requests: ${requests} · ${latestPending ? (pause.checked ? "response paused" : "waiting") : requests ? outcome : server && stop ? "server data adopted" : "no browser request yet"}`;
    document.body.dataset.pending = String(pending);
    document.body.dataset.requests = String(requests);
  }
  const unobserve = observeOperations((endpoint) => {
    if (!endpoint.endsWith(lesson === "query" ? "/readPeople" : "/findPeople")) return () => {};
    const fail = document.getElementById("fail-next") as HTMLInputElement;
    const slow = document.getElementById("slow-next") as HTMLInputElement;
    const delayed = slow?.checked;
    if (slow) slow.checked = false;
    if (latestPending) superseded++;
    latestPending = true;
    document.body.dataset.superseded = String(superseded);
    const number = ++requests;
    pending++;
    updateStatus();
    if (delayed && !pause.checked) status.textContent = `Request ${requests} · 2400 ms demo delay`;
    return (response) => {
      if (number === requests) {
        if (fail && response?.status === 503) fail.checked = false;
        latestPending = false;
        outcome = response
          ? response.ok
            ? "response received"
            : `failed (${response.status})`
          : "request ended";
      }
      pending--;
      if (!disposed) updateStatus();
    };
  });
  function start() {
    if (stop || disposed) return;
    if (server) {
      activate(host);
      stop = () => destroy(host);
    } else stop = mount(host.querySelector<HTMLElement>("#app")!, Component);
    document.body.dataset.active = "true";
    updateStatus();
  }
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== location.origin || !event.data) return;
    if (event.data.type === "publr:awaited:setup") {
      server = event.data.server;
      host.innerHTML = event.data.html;
      pause.checked = event.data.controlled;
      controls.hidden = !event.data.controlled;
      updateStatus();
      if (event.data.active) start();
      document.body.dataset.loaded = "true";
      parent.postMessage({ type: "publr:awaited:loaded", id }, location.origin);
    } else if (event.data.type === "publr:awaited:start") start();
  });
  pause.onchange = async () => {
    pause.disabled = true;
    try {
      await control(pause.checked ? "hold" : "auto");
    } finally {
      pause.disabled = false;
      updateStatus();
    }
  };
  respond.onclick = async () => {
    respond.disabled = true;
    try {
      await control("release");
    } finally {
      updateStatus();
    }
  };
  window.addEventListener("pagehide", () => {
    disposed = true;
    stop?.();
    unobserve();
  });

  for (const [id, action] of [
    ["fail-next", "fail"],
    ["slow-next", "slow"],
  ]) {
    const input = document.getElementById(id) as HTMLInputElement;
    if (!input) continue;
    input.onchange = async () => {
      input.disabled = true;
      try {
        await control(input.checked ? action : `cancel-${action}`);
      } finally {
        input.disabled = false;
      }
    };
  }
}
