import type { ContentContext } from "../../app/walkthrough/content";
import { paragraph, term, fileTabs } from "../../app/walkthrough/content";

export function listContent(ctx: ContentContext, index: number, server: boolean) {
  const { source, listLesson, stateDOM } = ctx;
  const stateCode = ctx.stateCode;
  const description = paragraph();
  if (index === 0) {
    description.parts.push(
      term("For", "Creates a row for each item and keeps the rows in sync when the list changes."),
      " creates one row per item. Its ",
      term("key", "A stable identity for a row. Here, the item number identifies it."),
      " identifies that row.",
    );
    return [description, stateCode("ItemList.ptsx", source.trim())];
  }
  if (server) {
    description.parts = [
      "Zig renders the two initial rows. Publr connects them to items in the browser.",
    ];
    const html = stateCode("Generated HTML", listLesson!.html.trim());
    html.children.push(paragraph("The comments mark the list and each row."));
    const store = stateCode(
      "JavaScript · store setup",
      'createLocalStore("List", () => ({\n  state: { items: [1, 2] },\n  actions: ({ state }) => ({\n    add() {\n      state.items = [...state.items, state.items.length + 1];\n    },\n    remove() {\n      state.items = state.items.slice(0, -1);\n    }\n  })\n}));',
    );
    store.children.push(paragraph("The generated For code keeps the rows in sync with items."));
    return [
      description,
      fileTabs([
        { name: "HTML", card: html },
        { name: "JavaScript · store", card: store },
      ]),
    ];
  }
  description.parts = ["dom.forEach watches items and matches rows by key."];
  const values = stateDOM
    .slice(stateDOM.indexOf("let items"), stateDOM.indexOf("publr.captureActions"))
    .trim()
    .replace(/^  /gm, "")
    .replace(/function (\w+)\(\) \{\n\s*([^\n]+)\n\}/g, "function $1() { $2 }");
  const rows =
    stateDOM
      .match(/dom\.forEach\([\s\S]*?^          \)/m)![0]
      .replace(/^          /gm, "")
      .replace(
        /dom\.append\(\s*element,\s*dom\.insert\(\(\) => item\(\)\),\s*\);/g,
        "dom.append(element, dom.insert(() => item()));",
      )
      .replace(/\(item\) =>\n\s*dom\.element/g, "(item) => dom.element") + ";";
  return [
    description,
    stateCode("Generated JavaScript · state + actions", values),
    stateCode(
      "Generated JavaScript · rows + clicks",
      rows + '\ndom.event(addButton, "click", add);\ndom.event(removeButton, "click", remove);',
    ),
  ];
}
