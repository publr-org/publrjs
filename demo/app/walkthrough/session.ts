import { state } from "publr";
import { lessonPresentation, type LessonPresentation } from "../../chapters/presentation";
import type { LessonOptions } from "../../chapters/types";
export function tutorialSession(options: LessonOptions) {
  return state({
    options,
    presentation: lessonPresentation(options),
    walkthrough: null as "zig" | "javascript" | null,
    comparison: false,
    compareVisible: true,
    returnFocus: () => {},
  }).value;
}
export type TutorialSession = {
  options: LessonOptions;
  presentation: LessonPresentation;
  walkthrough: "zig" | "javascript" | null;
  comparison: boolean;
  compareVisible: boolean;
  returnFocus: () => void;
};
