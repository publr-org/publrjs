import { resolve } from "node:path";

export const demoRoot = import.meta.dirname;
// Public teaching filenames and URLs remain stable while sources live by responsibility.
export function demoFile(name) {
  if (
    name.startsWith("backend/") ||
    name.startsWith("examples/") ||
    name.startsWith("dist/") ||
    name.startsWith("zig-out/")
  )
    return resolve(demoRoot, name);
  if (/^[A-Z].*\.ptsx$/.test(name)) return resolve(demoRoot, "examples/components", name);
  if (/^[A-Z].*\.(js|zig|html)$/.test(name))
    return resolve(demoRoot, ".generated/components", name);
  if (name === "server.zig") return resolve(demoRoot, "native", name);
  if (name.endsWith(".css")) return resolve(demoRoot, "styles", name);
  if (name.endsWith(".js.txt") || name.endsWith("-store.html"))
    return resolve(demoRoot, "chapters/snippets", name);
  if (name.endsWith("-frame.html")) return resolve(demoRoot, "previews/templates", name);
  if (name.endsWith(".html")) return resolve(demoRoot, ".generated/pages", name);
  if (["shared-counter.ts", "query-write.ts"].includes(name))
    return resolve(demoRoot, "examples/state", name);
  return resolve(demoRoot, name);
}
