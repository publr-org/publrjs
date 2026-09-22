import { createRouter } from "publr/router";
import { effect } from "publr";

export function start(host: HTMLElement) {
  const router = createRouter({
    commit: "manual",
    routes: [
      { id: "a", path: "/learn/navigation/a" },
      { id: "b", path: "/learn/navigation/b" },
    ],
  }).start();

  // Only this heading changes. The input and its draft stay mounted.
  effect(() => {
    host.querySelector("h2")!.textContent = router.current.pathname.endsWith("/b")
      ? "Page B"
      : "Page A";
    router.commit();
  });
  return "Router started. SPA links update the heading and URL; document links reload.";
}
