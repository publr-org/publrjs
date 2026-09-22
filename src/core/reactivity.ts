// Effect system: dependency tracking, microtask-batched flushing, and effect
// scopes. Foundation layer — imports nothing but types.
//
// EffectRecord/Scope field names are hand-minified (see types.ts): d=deps,
// x=disposed, l=label, s=scheduler, g=getter name, r=run, e=effects,
// c=cleanups. Functions are `const` arrows because esbuild keeps the
// `function` keyword verbatim (~9B each); nothing here relies on hoisting.

import type {
  AuthoredEffect,
  EffectContext,
  EffectOptions,
  EffectRecord,
  EffectRunner,
  Scope,
} from "./types";

const MAX_FLUSH_DEPTH = 100;

let pureDepth = 0;
export function pure<T>(run: () => T): T {
  pureDepth++;
  try {
    return run();
  } finally {
    pureDepth--;
  }
}
let activeEffect: EffectRecord | null = null;
let activeScope: Scope | null = null;
let flushScheduled = false;
let flushDepth = 0;

const targetDeps = new WeakMap<object, Map<PropertyKey, Set<EffectRecord>>>();
const pendingEffects = new Set<EffectRecord>();
const renderJobs = new Set<() => void>();
const postJobs = new Set<() => void>();
const ensureFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
};
export const scheduleRender = (job: () => void): void => {
  renderJobs.add(job);
  ensureFlush();
};
const schedulePost = (job: () => void): void => {
  postJobs.add(job);
  ensureFlush();
};

export const collectReadiness = (check: () => void): void => {
  activeEffect?.readiness?.add(check);
};

export class Pending extends Error {
  constructor() {
    super("Reactive dependency is pending");
  }
}

// Store-change subscriptions are layered on top of the effect system; the
// subscribe module registers its notifier here so this layer stays
// dependency-free.
type ChangeNotifier = (
  target: object,
  key: PropertyKey,
  oldValue: unknown,
  newValue: unknown,
) => void;

let changeNotifier: ChangeNotifier | null = null;

export const setChangeNotifier = (fn: ChangeNotifier): void => {
  changeNotifier = fn;
};

export const track = (target: object, key: PropertyKey): void => {
  if (!activeEffect) {
    return;
  }

  let keyMap = targetDeps.get(target);

  if (!keyMap) {
    targetDeps.set(target, (keyMap = new Map()));
  }

  let dep = keyMap.get(key);

  if (!dep) {
    keyMap.set(key, (dep = new Set()));
  }

  dep.add(activeEffect);
  activeEffect.d.push(dep);
};

export const assertWritable = (): void => {
  if (pureDepth) throw new Error("publr: key callbacks must be pure");
  if (activeEffect?.g) throw new Error(`Computed getter '${activeEffect.g}' must be pure`);
};

export const trigger = (
  target: object,
  key: PropertyKey,
  oldValue: unknown,
  newValue: unknown,
): void => {
  if (activeEffect?.g) {
    throw new Error(`Computed getter '${activeEffect.g}' must be pure`);
  }

  const dep = targetDeps.get(target)?.get(key);

  if (dep) {
    // Invalidation can detach and reattach dependencies during iteration.
    // eslint-disable-next-line unicorn/no-useless-spread
    for (const record of [...dep]) {
      if (record.x) continue;
      if (record.invalidate) record.invalidate();
      else pendingEffects.add(record);
    }

    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flush);
    }
  }

  changeNotifier?.(target, key, oldValue, newValue);
};

const flush = (): void => {
  let lastLabels = "reactive render";
  try {
    while (pendingEffects.size || renderJobs.size || postJobs.size) {
      if (++flushDepth > MAX_FLUSH_DEPTH) {
        const offenders = [...pendingEffects]
          .slice(-3)
          .map((record) => record.l || "?")
          .join(", ");
        pendingEffects.clear();
        renderJobs.clear();
        postJobs.clear();
        throw new Error(`Infinite update loop: ${offenders || lastLabels}`);
      }

      if (!pendingEffects.size) {
        const jobs = renderJobs.size ? renderJobs : postJobs;
        const batch = [...jobs];
        jobs.clear();
        for (const job of batch) job();
        continue;
      }
      const batch = [...pendingEffects];
      lastLabels = batch.map((record) => record.l ?? "?").join(", ");
      pendingEffects.clear();

      // Scheduler pass FIRST (getter memos refresh their cached values), then
      // plain runs — effects must see refreshed memos within the same round.
      for (const record of batch) {
        record.s?.();
      }

      for (const record of batch) {
        if (!record.s) {
          record.r();
        }
      }
    }
  } finally {
    flushScheduled = false;
    flushDepth = 0;
  }
};

/** Detach `record` from every dep set it is registered in. */
const clearDeps = (record: EffectRecord): void => {
  for (const dep of record.d) {
    dep.delete(record);
  }

  record.d.length = 0;
};

/**
 * Run `fn` and re-run it whenever a reactive value it read changes (microtask-batched).
 * Returns a runner that re-runs inline and returns the last value.
 * `opts`: `lazy` (skip initial), `scheduler` (replaces `run()` when queued), `label` (cycle errors).
 */
export const effect = (fn: () => unknown, opts?: EffectOptions): EffectRunner => {
  let lastValue: unknown;
  const scope = activeScope;

  const record: EffectRecord = {
    invalidate: opts?.invalidate,
    d: [],
    x: false,
    l: opts?.label ?? null,
    s: opts?.scheduler ?? null,
    g: null,
    r() {
      if (record.x || isScopePaused(scope)) {
        return lastValue;
      }

      const previousChecks = record.readiness;
      if (previousChecks) {
        try {
          untrack(() => {
            for (const check of previousChecks) check();
          });
        } catch {
          return lastValue;
        }
        record.readiness = new Set();
      }
      clearDeps(record);
      const prev = activeEffect;
      activeEffect = record;

      const owner = activeScope;
      activeScope = scope;
      try {
        lastValue = fn();
      } finally {
        activeScope = owner;
        activeEffect = prev;
      }

      return lastValue;
    },
  };

  activeScope?.e.push(record);

  if (!opts?.lazy) {
    record.r();
  }

  // r() closes over `record` and never reads `this`, so the method itself IS
  // the runner — no wrapper arrow needed.
  const runner = record.r as EffectRunner;
  runner._e = record;

  return runner;
};

/**
 * Public component effect. Its first run and every reactive re-run happen in
 * a following microtask, after the current DOM/render flush has completed.
 * PublrJS internals continue to use `effect()` above for computed/render work.
 */
export const postEffect = (
  fn: AuthoredEffect,
  opts?: Pick<EffectOptions, "label" | "lazy">,
): EffectRunner => {
  let run = 0;
  let queued = false;
  let scheduleVersion = 0;
  let consecutiveRuns = 0;
  let resetPending = false;
  let internalRunner!: EffectRunner;
  let cleanup: (() => void) | undefined;
  onCleanup(() => {
    untrack(() => cleanup?.());
    cleanup = undefined;
  });

  const schedule = () => {
    if (queued) return;
    queued = true;
    const version = ++scheduleVersion;
    schedulePost(() => {
      if (version !== scheduleVersion) return;
      queued = false;
      if (!resetPending) {
        resetPending = true;
        setTimeout(() => {
          consecutiveRuns = 0;
          resetPending = false;
        }, 0);
      }
      if (++consecutiveRuns > MAX_FLUSH_DEPTH) {
        throw new Error(`Infinite update loop: ${opts?.label ?? "post-effect"}`);
      }
      internalRunner();
    });
  };

  internalRunner = effect(
    () => {
      const context: EffectContext = {
        isInitial: run === 0,
        run,
      };
      try {
        untrack(() => cleanup?.());
        cleanup = undefined;
        const result = fn(context);
        if (typeof result === "function") cleanup = result as () => void;
        run += 1;
        return result;
      } catch (error) {
        if (!(error instanceof Pending)) throw error;
      }
    },
    {
      lazy: true,
      scheduler: schedule,
      label: opts?.label,
    },
  );

  internalRunner._e.readiness = new Set();

  if (!opts?.lazy) schedule();

  const runner = (() => {
    if (queued) {
      queued = false;
      scheduleVersion += 1;
    }
    return internalRunner();
  }) as EffectRunner;
  runner._e = internalRunner._e;

  return runner;
};

export const createScope = (): Scope => {
  const scope: Scope = { e: [], c: [], parent: activeScope, children: new Set() };
  activeScope?.children?.add(scope);
  return scope;
};
export const isScopePaused = (scope: Scope | null | undefined): boolean => {
  for (let owner = scope; owner; owner = owner.parent) if (owner.paused) return true;
  return false;
};
export const resumeScope = (scope: Scope): void => {
  scope.paused = false;
  for (const record of scope.e) if (!record.x) pendingEffects.add(record);
  for (const child of scope.children ?? []) resumeScope(child);
  ensureFlush();
};

export const runInScope = <T>(scope: Scope | null, fn: () => T): T => {
  const prev = activeScope;
  activeScope = scope;

  try {
    return fn();
  } finally {
    activeScope = prev;
  }
};

export const disposeScope = (scope: Scope): void => {
  if (scope.disposed) return;
  scope.disposed = true;
  scope.parent?.children?.delete(scope);
  for (const child of scope.children ?? []) disposeScope(child);
  for (const record of scope.e) {
    clearDeps(record);
    record.x = true;
  }

  for (const cleanup of scope.c) {
    cleanup();
  }

  scope.e.length = 0;
  scope.c.length = 0;
};

export const onCleanup = (fn: () => void): void => {
  activeScope?.c.push(fn);
};

export const getActiveScope = (): Scope | null => activeScope;

/** Run `fn` with no effect tracking. Writes still trigger normally. */
export const untrack = <T>(fn: () => T): T => {
  const prev = activeEffect;
  activeEffect = null;

  try {
    return fn();
  } finally {
    activeEffect = prev;
  }
};
