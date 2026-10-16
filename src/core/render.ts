// A region stages all reads before publishing any DOM writes.
import {
  getActiveScope,
  isScopePaused,
  effect,
  onCleanup,
  Pending,
  reportFailure,
  runInScope,
  scheduleRender,
  untrack,
} from "./reactivity";
import type { EffectRunner, Scope } from "./types";

interface Job {
  owner: Scope | null;
  read: EffectRunner;
  commit: (value: any) => void;
  live: boolean;
  /** Its reads changed since its last commit (a new job is dirty). */
  dirty: boolean;
}
export interface Region {
  jobs: Set<Job>;
  queued: boolean;
  building: boolean;
  disposed: boolean;
  status?: (error: unknown, pending: boolean, failed: boolean) => void;
}
let current: Region | undefined;
export const createRegion = (): Region => ({
  jobs: new Set(),
  queued: false,
  building: true,
  disposed: false,
});
export function inRegion<T>(region: Region | undefined, work: () => T): T {
  const previous = current;
  current = region;
  try {
    return work();
  } finally {
    current = previous;
  }
}
export function flushRegion(region: Region): void {
  if (region.disposed || region.building) return;
  region.queued = false;
  const staged: Array<[Job, unknown]> = [];
  let failure: unknown;
  let failed = false;
  let pending = false;
  // Only the bindings whose reads changed are read again: a region of thousands
  // of bindings costs what changed, not what is mounted. A job stays dirty until
  // its value is committed, so a pending or failed flush reads it again.
  for (const job of region.jobs) {
    if (!job.live || !job.dirty || isScopePaused(job.owner)) continue;
    try {
      staged.push([job, inRegion(region, () => job.read())]);
    } catch (error) {
      if (error instanceof Pending) pending = true;
      else {
        failure = error;
        failed = true;
      }
    }
  }
  // A pending read holds the whole region back, and a boundary (Loading) shows
  // a failure instead of the content. Without a boundary, one failing binding
  // must not freeze the rest: the others commit, the failure is thrown after
  // (the scheduler reports it and carries on), and the failed binding stays
  // dirty so the next flush reads it again.
  if (pending || (failed && region.status)) {
    region.status?.(failure, pending, failed);
    return;
  }
  const errors: unknown[] = failed ? [failure] : [];
  // A commit builds nodes (an insert that turns into markup) in the scope that
  // made the binding, so what they own and reach (a family's instance) is the
  // binding's, not whatever runs the flush.
  for (const [job, value] of staged)
    if (job.live) {
      job.dirty = false;
      try {
        runInScope(job.owner, () => untrack(() => job.commit(value)));
      } catch (error) {
        job.dirty = true;
        errors.push(error);
      }
    }
  region.status?.(undefined, false, false);
  if (errors.length) {
    for (const error of errors.slice(1)) reportFailure(error);
    throw errors[0];
  }
}
function schedule(region: Region): void {
  if (region.queued || region.disposed) return;
  region.queued = true;
  scheduleRender(() => flushRegion(region));
}
export function render<T>(read: () => T, commit: (value: T) => void): void {
  const region = current ?? createRegion();
  const own = !current;
  const job: Job = {
    owner: getActiveScope(),
    read: effect(read, {
      lazy: true,
      scheduler: () => {
        job.dirty = true;
        schedule(region);
      },
    }),
    commit,
    live: true,
    dirty: true,
  };
  region.jobs.add(job);
  onCleanup(() => {
    job.live = false;
    region.jobs.delete(job);
    if (own) region.disposed = true;
  });
  if (own) {
    region.building = false;
    flushRegion(region);
  } else if (!region.building) schedule(region);
}
