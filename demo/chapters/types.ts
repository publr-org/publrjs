export type LessonOptions = {
  Component?: () => HTMLElement;
  source: string;
  domSource: string;
  companion?: string;
  renderOnly?: boolean;
  stateLesson?: boolean;
  derivedLesson?: { html: string };
  effectLesson?: { html: string };
  conditionalLesson?: { html: string };
  listLesson?: { html: string };
  inputLesson?: { html: string };
  switchLesson?: { html: string };
  refLesson?: { html: string };
  portalLesson?: {
    position?: boolean;
    focus?: boolean;
    publicHTML: string;
    storeSource: string;
    publicDOM: string;
  };
  awaitedLesson?: {
    failure?: boolean;
    query?: boolean;
    files?: { name: string; source: string }[];
    requestSource: string;
    storeSource: string;
    publicHTML: string;
    publicDOM: string;
  };
  reuseLesson?: { html: string; childSource: string; childDOM: string };
  compositionLesson?: { html: string; childSource: string; childDOM: string };
  propsLesson?: { html: string; childSource: string; childDOM: string; childCompanion: string };
  cleanupLesson?: { html: string; timerSource: string; timerDOM: string };
  sharedLesson?: { storeSource: string; html: string };
};
