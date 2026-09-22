export const groups: { title: string; chapters: [string, string | null][] }[] = [
  {
    title: "Getting started",
    chapters: [
      ["Introduction", "introduction"],
      ["Interaction", "interaction"],
    ],
  },
  {
    title: "Reactive UI",
    chapters: [
      ["State", "state"],
      ["Shared state", "shared-state"],
      ["Derived values", "derived"],
      ["Effects", "effects"],
      ["Conditional UI", "conditional"],
      ["Lists", "lists"],
      ["Inputs", "inputs"],
      ["Switch", "switch"],
      ["Refs", "refs"],
      ["Cleanup", "cleanup"],
    ],
  },
  {
    title: "Components",
    chapters: [
      ["Composition", "composition"],
      ["Props", "props"],
      ["Reuse", "reuse"],
    ],
  },
  {
    title: "Async and Query",
    chapters: [
      ["Awaited data", "awaited"],
      ["Failure and retry", "failure"],
      ["Query", "query"],
    ],
  },
  {
    title: "Overlays",
    chapters: [
      ["Portals", "portals"],
      ["Position", "position"],
      ["Focus", "focus"],
    ],
  },
  {
    title: "Building applications · Planned",
    chapters: [
      ["13 · Hybrid application", null],
      ["14 · Optimistic UI and identity", null],
      ["15 · Sharing and HTML", null],
      ["16 · Navigation", null],
      ["17 · Put it together", null],
    ],
  },
];
