import { setDirectiveValue } from "./directive-value";
import { setFocusScope, ownFocusScope } from "./focus";
import { replaceHtml } from "./lifecycle";
// Attribute directives: data-p-on / -text / -show / -class / -bind / -style /
// -model. Each wire* function binds one element to its resolved store; wiring
// (lifecycle.ts) passes in the full attribute name the function was registered
// under, so each attribute literal lives once, in the wiring table.

import { effect } from "./reactivity";
import { matchArm, parseBindings, parseMatch, resolvePath, scan, unquoteLiteral } from "./parse";
import {
  bindPredicate,
  bindRef,
  isComposite,
  isGroup,
  resolveElementValue,
  resolveRef,
  resolveValuePath,
  specLiterals,
  specValue,
} from "./resolve";
import { writePathOnState } from "./model-paths";
import { ga, isFn, listen, setIfChanged } from "./util";

const KEY_MODIFIERS: Record<string, string> = {
  enter: "Enter",
  space: " ",
  esc: "Escape",
  escape: "Escape",
  tab: "Tab",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  home: "Home",
  end: "End",
  delete: "Delete",
};

/** Invoke a compiled JSX action, including action props consumed by components. */
export const invokeAction = (el: Element, actionRef: string, event: Event): void => {
  const [store, rest] = resolveRef(actionRef, el);
  if (!store) return;
  const [state, actions] = store;
  const action = actions[rest];
  if (action) {
    // Actions receive a detached snapshot of data-* attributes.
    // eslint-disable-next-line typescript/no-misused-spread
    action({ ...(el as HTMLElement).dataset }, { el, event });
    return;
  }
  let fn = resolvePath(actions, rest);
  if (!isFn(fn)) fn = resolvePath(state, rest);
  if (isFn(fn)) fn();
};

export const wireOn = (el: Element, attr: string): void => {
  for (const [descriptor, actionRef] of parseBindings(ga(el, attr), ":")) {
    const [store] = resolveRef(actionRef, el);

    if (!store) {
      continue;
    }

    const [eventName, ...modifiers] = descriptor.split(".");
    const target: EventTarget = modifiers.includes("window")
      ? window
      : modifiers.includes("document")
        ? document
        : el;
    // Key-filter modifiers, resolved to the KeyboardEvent.key values they match.
    const keyFilters = modifiers.filter((m) => m in KEY_MODIFIERS).map((m) => KEY_MODIFIERS[m]);

    listen(
      target,
      eventName,
      (event) => {
        if (keyFilters.length && !keyFilters.includes((event as KeyboardEvent).key)) {
          return;
        }

        if (modifiers.includes("prevent")) {
          event.preventDefault();
        }

        if (modifiers.includes("stop")) {
          event.stopPropagation();
        }

        invokeAction(el, actionRef, event);
      },
      modifiers.includes("once") ? { once: true } : false,
    );
  }
};

// Value specs for data-p-text / data-p-bind values — payloads are QUOTED
// literals only; refs never appear on the right side, and anything richer
// belongs in the store (that no-expression-engine line is deliberate):
//
//   `$cond -> 'a' ~ 'b'`      flat form (predicates ok; ~'b' optional,
//                              defaults to the empty string)
//   `$v { a: 'x', _: 'y' }`   match form (shared evaluator; no arm and no
//                              `_` → undefined, so text writes "" and bind
//                              removes the attribute)
//   `$value ~ 'fallback'`      the value itself, falling back when null/empty
//   `$v` / `not $v` / `$n > 2` plain ref or bare predicate
//   `($spec) { … }`, `'a' + $v`  nested specs (see `specValue` in resolve.ts)
const bindValue = (el: Element, spec: string, write: (value: unknown) => void): void => {
  // Nested specs (a component re-emitting a prop wire) evaluate as a whole.
  if (isComposite(spec)) {
    const read = specValue(el, spec);
    effect(() => write(read()));
    return;
  }

  // The flat form IS a two-arm match (`pred -> 'a' ~ 'b'` ≡
  // `pred { true: 'a', false: 'b' }`) — one evaluator serves both.
  const armsFor = (m: [string, Array<[string, string]>, ...unknown[]]) =>
    bindPredicate(el, m[0], (value) => {
      const payload = matchArm(m[1], value);

      write(payload == null ? payload : unquoteLiteral(payload));
    });

  const [head, arrowRest] = scan(spec, ["->"], 1);

  if (arrowRest != null) {
    const [onRaw, offRaw = "''"] = scan(arrowRest, ["~"], 1);

    armsFor([
      head,
      [
        ["true", onRaw],
        ["false", offRaw],
      ],
    ]);
    return;
  }

  const m = parseMatch(spec);

  if (m) {
    armsFor(m);
    return;
  }

  const [refPart, fallbackRaw] = scan(spec, ["~"], 1);

  if (fallbackRaw != null) {
    const fallback =
      resolveElementValue(el, fallbackRaw.trim()) ?? unquoteLiteral(fallbackRaw) ?? "";

    bindRef(el, refPart.trim(), (store, rest) => {
      const value = resolveValuePath(store, rest);
      write(value == null || value === "" ? fallback : value);
    });
    return;
  }

  bindPredicate(el, spec, write);
};

export const wireText = (el: Element, attr: string): void => {
  const ref = ga(el, attr);

  if (ref) {
    bindValue(el, ref, (text) => {
      el.textContent = text == null ? "" : String(text);
    });
  }
};

const splitClasses = (s: string): string[] => scan(s, [" ", "\t", "\n", "\r"]).filter(Boolean);

// Substitute interpolation holes in class patterns: `{$}` → the match's
// mapped token, `{$name}` → the raw signal value (nullish → "", so a missing
// signal never yields classes like `bg-undefined`). Resolution happens inside
// the caller's reactive effect, so dependency tracking is automatic.
const fillHoles = (el: Element, patterns: string[], token: string): string[] =>
  patterns
    .map((p) =>
      p.replace(/\{\$([^}]*)\}/g, (_, name) => {
        if (!name) {
          return token;
        }

        const [store, rest] = resolveRef(name, el);

        return (store && resolveValuePath(store, rest)) ?? "";
      }),
    )
    .filter(Boolean);

// GENERATED class lists (templates / bare interpolation) have an unknowable
// class universe, so each run swaps against what the PREVIOUS run applied:
// remove the last list, fill holes with `token`, add the result —
// remove-then-add so overlap survives. Returns the per-group applier.
const classListApplier = (el: Element): ((classes: string[]) => void) => {
  let last: string[] = [];
  return (classes) => {
    for (const name of last) el.classList.remove(name);
    last = classes;
    for (const name of last) el.classList.add(name);
  };
};
const templateApplier = (el: Element, patterns: string[]) => {
  const apply = classListApplier(el);
  return (token?: string) => apply(token == null ? [] : fillHoles(el, patterns, token));
};

/**
 * The class engine: one binding per group, arm payloads are class lists.
 * Remove every NON-matched arm's classes before adding the matched arm's —
 * an atomic swap even over server-rendered classes, and shared classes
 * survive (remove runs first), so paired utilities SWAP instead of stacking
 * (conflicting classes stacked on one element resolve by CSS order, not by
 * which was toggled last). The flat `->`/`~` form and data-p-show route
 * through here as two-arm true/false matches.
 */
const bindClassArms = (el: Element, disc: string, arms: Array<[string, string]>): void => {
  bindPredicate(el, disc, (value) => {
    const matched = matchArm(arms, value);

    for (const [, payload] of arms) {
      if (payload !== matched) {
        for (const name of splitClasses(payload)) {
          el.classList.remove(name);
        }
      }
    }

    for (const name of splitClasses(matched ?? "")) {
      el.classList.add(name);
    }
  });
};

// data-p-show is exactly a class binding: `hidden` is the falsy arm.
export const wireShow = (el: Element, attr: string): void => {
  const spec = ga(el, attr);

  if (spec) {
    bindClassArms(el, spec, [["false", "hidden"]]);
    // SSR may use the native attribute to prevent a flash before hydration.
    // Once the reactive class binding is active it owns visibility; retaining
    // the attribute would keep the element hidden after the class is removed.
    el.removeAttribute("hidden");
  }
};

// data-p-class: `;`-separated groups, each one of three forms.
//
//   `$open -> a b ~ c`            flat — IF/ELSE class lists swap atomically
//   `$env { a: x, _: y } => {…}`  match — arms swap; `=> { … }` pipes the
//                                  matched TOKEN into `{$}` template holes
//   `bg-{$color}`                  bare interpolation — `{$name}` holes only
//   `($spec)`                      a value spec whose value is the class list
//                                  (a component's wired `classes` prop): each
//                                  run removes every other list the spec can
//                                  produce, so a server-rendered one goes too
export const wireClass = (el: Element, attr: string): void => {
  for (const group of scan(ga(el, attr) || "", [";"])) {
    if (isGroup(group.trim())) {
      const read = specValue(el, group);
      const universe = (specLiterals(group) ?? []).flatMap(splitClasses);
      const apply = classListApplier(el);
      effect(() => {
        const value = read();
        const classes = value == null || value === false ? [] : splitClasses(String(value));
        for (const name of universe) if (!classes.includes(name)) el.classList.remove(name);
        apply(classes);
      });
      continue;
    }

    const [head, arrowRest] = scan(group, ["->"], 1);

    if (arrowRest != null) {
      // Optional top-level `~` splits IF / ELSE branches. `~` is safe:
      // in class names it only occurs inside [...] arbitrary variants.
      const [onPart, offPart = ""] = scan(arrowRest, ["~"], 1);

      bindClassArms(el, head, [
        ["true", onPart],
        ["false", offPart],
      ]);
      continue;
    }

    const m = parseMatch(group);

    if (m) {
      const [disc, arms, template] = m;

      if (template == null) {
        bindClassArms(el, disc, arms);
      } else {
        // Template arms map to a single token, piped into the {$} holes.
        const patterns = splitClasses(template);
        bindPredicate(el, disc, classListApplier(el), (value) => {
          const token = matchArm(arms, value);
          return token == null ? [] : fillHoles(el, patterns, token);
        });
      }

      continue;
    }

    // Bare interpolation: substitution reads its signals inside the effect,
    // so the group re-renders when any hole's value changes.
    if (/\{\$/.test(group)) {
      const apply = templateApplier(el, splitClasses(group));

      effect(() => {
        apply("");
      });
    }
  }
};

const setBoundAttribute = (el: Element, attr: string, value: unknown): void => {
  if (setDirectiveValue(el, attr, value)) return;
  if (attr === "focusScope") {
    setFocusScope(el, value);
    return;
  }
  if (attr === "innerHTML") {
    replaceHtml(el, value);
    return;
  }
  if (attr === "value") {
    (el as HTMLInputElement).value = (value as string) ?? "";
    return;
  }

  if (attr === "checked") {
    (el as HTMLInputElement).checked = !!value;
    return;
  }

  // Like `checked`, `indeterminate` is a DOM property with no attribute
  // serialization — SSR can never render it, so a binding is the only way to
  // express the mixed state of a tri-state checkbox.
  if (attr === "indeterminate") {
    (el as HTMLInputElement).indeterminate = !!value;
    return;
  }

  // ARIA states are tri-state STRINGS, not boolean presence attributes:
  // aria-expanded="" reads as neither true nor false to assistive tech, and
  // removing the attribute on false erases the semantic entirely. Booleans
  // bound to aria-* serialize as "true"/"false"; null/undefined still remove
  // (unset stays unset).
  if (attr.startsWith("aria-") && typeof value === "boolean") {
    el.setAttribute(attr, String(value));
    return;
  }

  if (value == null || value === false) {
    el.removeAttribute(attr);
    return;
  }

  el.setAttribute(attr, value === true ? "" : String(value));
};

export const wireBind = (el: Element, attr: string): void => {
  // Entries split name:value on the FIRST top-level colon — arm-key colons
  // live inside `{…}` and quoted colons inside literals, so both survive.
  for (const [name, ref] of parseBindings(ga(el, attr), ":")) {
    if (name === "focusScope") ownFocusScope(el);
    bindValue(el, ref, (value) => setBoundAttribute(el, name, value));
  }
};

export const wireStyle = (el: Element, attr: string): void => {
  for (const [property, ref] of parseBindings(ga(el, attr), "->")) {
    bindRef(el, ref, (store, rest) => {
      const value = resolveValuePath(store, rest);
      const style = (el as HTMLElement).style;

      if (value == null || value === false) {
        style.removeProperty(property);
      } else {
        style.setProperty(property, String(value));
      }
    });
  }
};

// ── data-p-model ─────────────────────────────────────────────────────────────

const writeVal = (el: HTMLInputElement, value: unknown): void => setIfChanged(el, "value", value);
const readVal = (el: HTMLInputElement): unknown => el.value;

// Per-kind element I/O, indexed by modelKind():
// 0=text 1=select 2=checkbox 3=radio 4=file 5=multiSelect 6=contentEditable.
// Entry: [write(el, value), read(el), commitsOnChangeEvent?]; `read` returning
// undefined means "no write-back" (e.g. unchecked radio).
const MODEL_IMPL: Array<[(el: any, value: unknown) => void, (el: any) => unknown, boolean?]> = [
  [writeVal, readVal],
  [writeVal, readVal, true],
  [
    (el, value) => {
      el.checked = !!value;
    },
    (el) => el.checked,
    true,
  ],
  [
    (el, value) => {
      el.checked = String(value) === el.value;
    },
    (el) => (el.checked ? el.value : undefined),
    true,
  ],
  [() => {}, (el) => (el.files ? [...el.files] : []), true],
  [
    (el, value) => {
      const values = Array.isArray(value) ? value.map(String) : [];

      for (const option of el.options) {
        option.selected = values.includes(option.value);
      }
    },
    (el) => Array.from(el.selectedOptions, (option: HTMLOptionElement) => option.value),
    true,
  ],
  [(el, value) => setIfChanged(el, "textContent", value), (el) => el.textContent],
];

const modelKind = (el: Element): number => {
  const tag = el.tagName;

  if (tag === "INPUT") {
    const type = (ga(el, "type") || "").toLowerCase();

    return type === "checkbox" ? 2 : type === "radio" ? 3 : type === "file" ? 4 : 0;
  }

  if (tag === "SELECT") {
    return (el as HTMLSelectElement).multiple ? 5 : 1;
  }

  return ga(el, "contenteditable") != null ? 6 : 0;
};

const applyModelModifiers = (value: unknown, modifiers: Set<string>): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const next = modifiers.has("trim") ? value.trim() : value;

  if (modifiers.has("number") && next !== "") {
    const numeric = +next;

    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return next;
};

export const wireModel = (el: Element, attr: string): void => {
  const spec = ga(el, attr);

  if (!spec) {
    return;
  }

  // `$draft|lazy|trim` — the ref first ($ sigil ok), then stacked modifiers.
  const parts = spec.split("|");
  const [store, rest] = resolveRef(parts[0], el);

  if (!store) {
    return;
  }

  const state = store[0];
  const modifiers = new Set(parts.slice(1));
  const [write, read, changes] = MODEL_IMPL[modelKind(el)];

  effect(() => write(el, resolvePath(state, rest)));

  listen(el, changes || modifiers.has("lazy") ? "change" : "input", () => {
    const raw = read(el);

    if (raw !== undefined) {
      writePathOnState(state, rest, applyModelModifiers(raw, modifiers));
    }
  });
};
