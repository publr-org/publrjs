import type { PortalTarget } from "./core/portal";
import type { PositionBinding } from "./core/position";
import type { Ref } from "./core/types";

type ElementEvent<T> = Event & { readonly currentTarget: T };
type Attributes<T extends Element> = {
  children?: unknown;
  ref?: Ref<T>;
  portal?: PortalTarget;
  position?: PositionBinding | "left" | "right" | false;
  onClick?: (event: ElementEvent<T>) => unknown;
  onInput?: (event: ElementEvent<T>) => unknown;
  onChange?: (event: ElementEvent<T>) => unknown;
  onKeyDown?: (event: KeyboardEvent & { readonly currentTarget: T }) => unknown;
  [attribute: string]: unknown;
};
declare global {
  namespace JSX {
    type Element = Node;
    interface ElementChildrenAttribute {
      children: unknown;
    }
    type IntrinsicElements = {
      [Tag in keyof HTMLElementTagNameMap]: Attributes<HTMLElementTagNameMap[Tag]>;
    } & {
      [Tag in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: Attributes<
        SVGElementTagNameMap[Tag]
      >;
    };
  }
}
