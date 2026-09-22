import "../.generated/components/SimpleCounter.behavior.js";

// The counter already exists in the HTML response from Zig.
// The lesson deliberately delays loading this behavior companion until activation.
export function start(host: HTMLElement) {
  const original = host.querySelector("output");
  return host.querySelector("output") === original
    ? "Hydrated. The original output node was preserved."
    : "Hydration replaced the output node.";
}
