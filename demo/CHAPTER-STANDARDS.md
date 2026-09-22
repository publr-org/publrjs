# Required chapter standards

The user approved the introduction and interaction chapters on 2026-09-09 as
exactly the expected quality. These are the reference implementation, not rough
prototypes. Future chapters must meet the same standard before being presented.

## Series boundary and continuation

Lesson 12 · Focus ends the dual-target feature series. Planned lessons 13–17
continue as **Building applications**, using the same minimal quality baseline:
small examples, working demos, very little visible copy, and on-demand explainers.

For these application lessons, use one main demo or the comparison that teaches
the topic; two rendering-target previews are optional. Preserve the approved
visual patterns and applicable inspection, replay, accessibility, and verification
requirements below. Keep extensive options and edge cases in reference docs.
See the [accepted continuation plan](../docs/tutorial-presentation-plan.md#accepted-direction-after-lesson-12)
for each lesson's scope. This section overrides any requirement below that would
force the application lessons into a dual-target layout.

## Teach progressively

- Keep the main chapter minimal: authored PTSX, two target previews, short copy,
  a “How it works” button for each target, and a Compare button.
- Reveal explanations on demand in dialogs. Teach one example, target, and idea
  at a time. Do not show all implementation details at once.
- Follow the concrete journey: authored PTSX, generated output, then a page-load
  simulation showing the result. Use debugger-like controls to advance it.
- A Load page action immediately shows the loaded response and advances progress;
  do not add a redundant Next step before the next meaningful operation.
- Keep earlier steps visible in Compare. Shared Next/Previous controls reveal or
  remove matching rows for both targets together.

## Authoring style

- Wrap multiline JSX returns in parentheses: `return (` on its own line,
  indented JSX beneath it, and `);` on its own line. Apply this to every
  authored component shown in lessons and walkthroughs.

## Explain simply and accurately

- Use short, plain-English sentences that describe what the learner can see.
  Avoid jargon-heavy context, vague summaries, and redundant explanations.
- Introduce technical terms sparingly. Underline new terms and provide concise,
  plain-English definitions on hover and keyboard focus.
- Highlight the same meaningful names across authored and generated snippets.
  Use readable names such as Hello and openAlert, not compiler hashes or temporary
  identifiers. Preserve the actual behavior and generated operations when renaming
  presentation variables.
- Show enough code to explain the connection. For HTML event examples, show both
  the HTML store/action references and the JavaScript store setup with actions.
  A standalone callback line does not explain the store relationship.
- Keep store-name highlights green and callback/action highlights blue.
- Verify explanations against the compiler and runtime. Do not invent simplified
  event wiring or misrepresent Publr as compiling SSR events directly into browser
  handlers. HTML references companion store actions through data-p attributes;
  the Publr runtime connects them. DOM examples should show the generated DOM
  operations, including automatic event setup where applicable.
- Any JavaScript presented as compiled output must use supported public PublrJS syntax
  that a person could actually write and run by hand with standalone data-p HTML.
  PTSX is an authoring layer on top of that model. Do not expose compiler/runtime
  adapters, internal wiring, engine operations, or incomplete internal fragments.
  A “readable view” label does not permit invented APIs or non-executable syntax.
  When the public API cannot express a connection, explain it visually and identify
  the API gap; do not disguise an internal helper as public store registration.
- Keep rendering-only chapters about rendering. The SSR greeting is ready with
  the initial HTML; CSR initially has an app placeholder, then renders. Do not
  introduce hydration or actions when the example does not need them.

- Variations keep the same PTSX authoring model for both targets. Shared state
  changes ownership, not the authoring language. Show data-p HTML only as actual
  generated output; do not substitute handwritten HTML for a missing compiler path.
- The state-sharing variation opens with the headline and real Zig/JavaScript
  counter previews, followed by Share the count. Keep the source transition in
  an on-demand dialog rather than an additional boxed page section.
- Introduce ownership changes through working local counters, moving state out,
  and importing it into the same component. Do not replace that progression with
  introductory paragraphs.

- A display-only child does not need its own browser store merely because it is a component. Show its incoming value as a binding in the owning parent store when lowering can resolve it directly. Static composition produces plain HTML without browser stores.

- A static parent that only composes children with fixed props does not need its own store either. Keep stores on the interactive children; verify actual generated output and independent activation instead of stripping a parent store from the teaching snippet.

- Do not query elements to initialize local store state. Direct `data-p-text` bindings adopt initial text using the store default’s type; explicit serialized state takes precedence. Use refs for authored element interactions.

- Present HTML as the server target’s generated output. Do not show lowered Zig
  or raw internal companion formats such as `html.template(...)` to learners.

## Preserve the approved UI

- Every Demo step and comparison preview includes live HTML inspection, enabled by
  default. Before loading, show a no-response message. Use indented HTML, the
  established highlights, and generated stripes. Preserve actual DOM attributes
  and runtime comments. Disconnect inspectors on dismissal, replay, and removal.
- On wide screens, expand Demo dialogs to show the scene and inspector side by
  side with aligned panels. Stack them on narrow screens. Keep the checkbox and
  live-HTML caption on one header row. Other steps retain their normal width.
- Generated store and request files use the same striped background as other
  generated code. Keep authored sources plain and HTML and DOM lowering distinct.
- Reuse the PTSX components in `app/components/` (`Walkthrough`, `PageDebugger`,
  `Comparison`, and `LessonContent`) and `styles/chapter/` so chapters stay
  consistent. Individual walkthroughs use an 800px responsive dialog and a gray scene card,
  with a step wizard at the top of the page-load simulation.
- Keep the Zig/JavaScript column header at the top of Compare. Below it, show
  one centered source panel because both targets share the first step. Subsequent steps use two equal columns with aligned rows, a
  vertical divider reaching the footer, and horizontal dividers spanning the
  entire dialog width. Earlier rows remain available by scrolling.
- Keep column labels visible while scrolling and shared controls in the footer.
  Center the step counter independently of the Previous/Next button widths.
- Introduce the authored/generated visual key in the first walkthrough and
  comparison step. Authored code is plain; generated output has subtle diagonal
  stripes. Do not add code-origin badges or duplicate labels beneath file tabs. Keep equivalent store API presentations technically usable by hand. Keep state/action highlights separate from this distinction.
- Use keyboard-accessible file tabs for every multi-file example, including
  guided transitions. Keep filenames in the tabs, omit file counters and duplicate labels below the tabs, and have
  Next/Previous advance the active tab so file changes are explicit. Preserve code lines
  without wrapping and provide horizontal scrolling inside code panels.
- On the main page, put file tabs in the existing source card’s header. Do not add a nested card or separate file-navigation buttons.
- Left-align copy and code. Keep preview frames left-aligned in Compare; retain
  the approved centered simulation layout in individual walkthroughs.
- All preview action buttons use black backgrounds, white text, and dark gray
  hover states, consistently before and after setup. Navigation controls retain
  their established styling.
- Preserve keyboard access, dialog dismissal and focus return, tooltip access,
  reduced-motion support, and usable narrow-screen layouts.

## Verify before presenting

- Use real demo responses and runtime rendering/setup for simulations. Preserve
  earlier snapshots: an unconnected SSR button must remain unconnected even after
  the later interactive row is revealed.
- Dispose runtime mounts and abort pending requests when closing or replaying.
- Run checks appropriate to the change. For behavior changes, verify both targets,
  progressive reveal, Previous/replay/reopen, and the final demonstrated behavior.
  Shared changes must also preserve existing chapters.
- Inspect the rendered UI at desktop and narrow widths for layout changes. Confirm
  alignment, dividers, scrolling, overflow, and controls before presenting it.
- Report what was completed and actually verified. Do not present unfinished or
  unverified work as meeting this quality baseline.
