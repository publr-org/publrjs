// Runs in the head before paint, including inside lesson preview frames.
(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const read = () => {
    if (window.parent !== window) {
      try {
        return parent.document.documentElement.dataset.theme;
      } catch {}
    }
    try {
      const saved = localStorage.getItem("publr:theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {}
    return media.matches ? "dark" : "light";
  };
  const apply = () => {
    document.documentElement.dataset.theme = read();
    window.dispatchEvent(new Event("publr:theme-change"));
  };
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", apply);
  if (window.parent !== window) {
    try {
      parent.addEventListener("publr:theme-change", apply);
      window.addEventListener(
        "pagehide",
        () => parent.removeEventListener("publr:theme-change", apply),
        { once: true },
      );
    } catch {}
  }
})();
