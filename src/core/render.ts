// A region stages all reads before publishing any DOM writes.
import {
  getActiveScope,
  isScopePaused,
  effect,
  onCleanup,
  Pending,
  scheduleRender,
  untrack,
} from "./reactivity";
import type { EffectRunner, Scope } from "./types";

interface Job {
  owner: Scope | null;
  read: EffectRunner;
  commit: (value: any) => void;
  live: boolean;
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
  for (const job of region.jobs) {
    if (!job.live || isScopePaused(job.owner)) continue;
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
  if (pending || failed) {
    if (region.status) region.status(failure, pending, failed);
    else if (failed) throw failure;
    return;
  }
  for (const [job, value] of staged) if (job.live) untrack(() => job.commit(value));
  region.status?.(undefined, false, false);
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
    read: effect(read, { lazy: true, scheduler: () => schedule(region) }),
    commit,
    live: true,
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
