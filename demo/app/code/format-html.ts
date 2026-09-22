/** Format a detached snapshot; preserve attributes, text and runtime comments. */
export function formatPreviewHTML(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const voidTags = new Set(
    "area base br col embed hr img input link meta param source track wbr".split(" "),
  );
  function format(node: Node, depth: number): string {
    const indent = "  ".repeat(depth);
    if (node.nodeType === Node.COMMENT_NODE) return `${indent}<!--${node.textContent}-->`;
    if (node.nodeType === Node.TEXT_NODE)
      return node.textContent?.trim() ? indent + escape(node.textContent) : "";
    if (!(node instanceof Element)) return "";
    const tag = node.localName;
    if (["script", "style", "pre", "textarea"].includes(tag)) return indent + node.outerHTML;
    const attrs = Array.from(
      node.attributes,
      (attr) => `${attr.name}="${escape(attr.value).replaceAll('"', "&quot;")}"`,
    );
    const opening = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
    const start =
      opening.length + indent.length > 110 && attrs.length > 1
        ? `${indent}<${tag}\n${attrs.map((attr) => `${indent}  ${attr}`).join("\n")}\n${indent}>`
        : indent + opening;
    if (voidTags.has(tag)) return start;
    const children = Array.from(
      node instanceof HTMLTemplateElement ? node.content.childNodes : node.childNodes,
    );
    if (children.every((child) => child.nodeType === Node.TEXT_NODE))
      return `${start}${children.map((child) => escape(child.textContent ?? "")).join("")}</${tag}>`;
    return `${start}\n${children
      .map((child) => format(child, depth + 1))
      .filter(Boolean)
      .join("\n")}\n${indent}</${tag}>`;
  }
  return Array.from(template.content.childNodes, (node) => format(node, 0))
    .filter(Boolean)
    .join("\n");
}
