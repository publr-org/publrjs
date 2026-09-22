// The DOM face of the `publr-jsx` import a component writes. The compiler
// lowers a component to calls on this module: the `$$dom.*` primitives come
// straight from the DOM target, and the authoring helpers the Zig target
// erases — `Dynamic`, `Slot`, `initials` and `gravatarUrl` — live here.
import * as dom from "./dom";

export * from "./dom";
export { Publr } from "../publr";

type Props = Record<string, unknown> & { children?: unknown };
type Make = (props: Props) => Node;

// The props of the component being rendered, so its `<Dynamic>` root can
// forward the `aria-*`, `data-*`, `role`, `tabindex` and `for` the caller passed.
let currentComponentProps: Props | null = null;
const forwardable = (name: string): boolean =>
  name.includes("-") || name === "role" || name === "tabindex" || name === "for";

export function component<P>(make: dom.Component<P>, props: P): Node {
  if ((make as unknown) === Dynamic) return Dynamic(props as Props);
  const previous = currentComponentProps;
  currentComponentProps = props as Props;
  try {
    return dom.component(make, props);
  } finally {
    currentComponentProps = previous;
  }
}

/** A polymorphic root: `as` names the tag, every other prop binds normally. */
export const Dynamic: Make = (props) => {
  const tag = props.as;
  if (tag instanceof Element) {
    bind(tag, props, null);
    return tag;
  }
  return dom.element(String(tag), (node) => bind(node, props, currentComponentProps));
};

/** Adopts exactly one authored element and merges the Slot's props onto it. */
export const Slot: Make = (props) => {
  const authored = props.children;
  let child: unknown = Array.isArray(authored) && authored.length === 1 ? authored[0] : authored;
  if (
    child instanceof DocumentFragment &&
    child.childElementCount === 1 &&
    child.childNodes.length === 1
  )
    child = child.firstElementChild;
  if (!(child instanceof Element))
    throw new TypeError("publr-jsx: Slot requires one Element child");
  const merged: Props = { ...props, as: child };
  delete merged.children;
  return Dynamic(merged);
};

function bind(node: Element, props: Props, forwarded: Props | null): void {
  if (forwarded)
    for (const key of Object.keys(forwarded)) {
      if (!forwardable(key) || Object.hasOwn(props, key)) continue;
      dom.attr(node, key, () => forwarded[key]);
    }
  for (const key of Object.keys(props)) {
    if (key === "as" || key === "children") continue;
    if (key === "ref") {
      const ref = props.ref;
      if (typeof ref === "function") (ref as (element: Element) => void)(node);
    } else if (/^on[A-Z]/.test(key)) {
      const name = key.slice(2).toLowerCase();
      dom.event(node, name, (event: Event) =>
        (props[key] as ((event: Event) => void) | undefined)?.(event),
      );
    } else if (key === "class") dom.classes(node, () => props.class);
    else if (key === "style") dom.styles(node, () => props.style);
    else dom.attr(node, key, () => props[key]);
  }
  // Read once: a children getter builds its nodes on every read, and a region
  // re-reads its inserts on every flush, so a thunk over the getter never settles.
  if (Object.hasOwn(props, "children")) {
    const children = props.children;
    dom.append(
      node,
      dom.insert(() => children),
    );
  }
}

/** Up to two uppercase initials from a name, as the server renders them. */
export const initials = (name: string): string =>
  name
    .split(/[ \t\n\r]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => {
      const first = word[0];
      return first >= "a" && first <= "z" ? first.toUpperCase() : first;
    })
    .join("");

/** Gravatar with a transparent fallback, so the initials underneath show. */
export const gravatarUrl = (email: string, size: number): string =>
  `https://gravatar.com/avatar/${md5(email.replace(/[ \t\n\r]/g, "").toLowerCase())}?d=blank&s=${size}`;

// RFC 1321, the one hash Gravatar wants; the server has the same routine.
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const words = new Uint32Array(((bytes.length + 8) >> 6) * 16 + 16);
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  words[words.length - 2] = bytes.length * 8;
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let block = 0; block < words.length; block += 16) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f = 0;
      let g = 0;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const s = S[(i >> 4) * 4 + (i % 4)];
      const t = (a + f + K[i] + words[block + g]) >>> 0;
      const next = (b + ((t << s) | (t >>> (32 - s)))) >>> 0;
      a = d;
      d = c;
      c = b;
      b = next;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const hex = (n: number) => {
    let out = "";
    for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    return out;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}
