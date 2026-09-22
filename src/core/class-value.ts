/** Shared JSX class semantics for HTML bindings and the direct DOM target. */
export function className(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(className).filter(Boolean).join(" ");
  if (typeof value === "object")
    return Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key])
      .join(" ");
  return String(value);
}
