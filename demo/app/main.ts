import { mount } from "publr/dom";
// @ts-expect-error Compiled PTSX component.
import { ThemeToggle } from "../.generated/app/components/ThemeToggle.js";
// @ts-expect-error Compiled PTSX component.
import { ChapterSidebar } from "../.generated/app/components/ChapterSidebar.js";

if (!document.getElementById("theme-toggle")) mount(document.body, ThemeToggle);
const navigation = document.getElementById("chapter-navigation");
if (navigation && !document.getElementById("chapter-menu")) mount(navigation, ChapterSidebar);
