import { state } from "publr";
export type TabSelection = {
  selection: { indices: Record<string, number>; sizes: Record<string, number> };
  index: (id: string) => number;
  select: (id: string, index: number) => void;
  register: (id: string, size: number) => void;
  canMove: (direction: number) => boolean;
  move: (direction: number) => boolean;
};
export function tabSelection() {
  const selection = state({
    indices: {} as Record<string, number>,
    sizes: {} as Record<string, number>,
  }).value;
  return {
    selection,
    index(id: string) {
      return selection.indices[id] ?? 0;
    },
    select(id: string, index: number) {
      selection.indices[id] = index;
    },
    register(id: string, size: number) {
      selection.sizes[id] = size;
    },
    canMove(direction: number) {
      return Object.keys(selection.sizes).some(
        (id) => this.index(id) + direction >= 0 && this.index(id) + direction < selection.sizes[id],
      );
    },
    move(direction: number) {
      let moved = false;
      for (const id of Object.keys(selection.sizes)) {
        const next = this.index(id) + direction;
        if (next >= 0 && next < selection.sizes[id]) {
          this.select(id, next);
          moved = true;
        }
      }
      return moved;
    },
  };
}
export function tabKey(event: KeyboardEvent, current: number, length: number): number | null {
  const next =
    event.key === "ArrowRight"
      ? (current + 1) % length
      : event.key === "ArrowLeft"
        ? (current + length - 1) % length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? length - 1
            : null;
  if (next !== null) event.preventDefault();
  return next;
}
