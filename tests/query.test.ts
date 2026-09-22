import { describe, expect, it, vi } from "vitest";
import { ResultCache } from "../src/core/query-cache";
import { invalidate } from "../src/addons/query";
import { awaited, isPending, refresh } from "../src/runtime";
import { deferred, tick } from "./helpers";

describe("awaited result retention", () => {
  it("shares concurrent consumers and explicit refreshes", async () => {
    const request = deferred<number>();
    const fetch = vi.fn(() => request.promise);
    const options = { cache: { key: ["shared-users"], ttl: 60000, tags: ["users"] } };
    const first = awaited(fetch, options);
    const second = awaited(fetch, options);
    expect(fetch).toHaveBeenCalledTimes(1);
    request.resolve(4);
    await tick();
    expect(first.read()).toBe(4);
    expect(second.read()).toBe(4);
    refresh(first);
    refresh(second);
    expect(fetch).toHaveBeenCalledTimes(2);
    await tick();
  });

  it("invalidates tags without allowing superseded responses to win", async () => {
    const old = deferred<number>();
    const next = deferred<number>();
    let calls = 0;
    const fetch = () => (++calls === 1 ? old.promise : next.promise);
    const result = awaited(fetch, {
      cache: { key: ["user", 1], ttl: 60000, tags: ["invalidate-users"] },
    });
    invalidate("invalidate-users");
    expect(isPending(result)).toBe(true);
    old.resolve(1);
    await tick();
    expect(isPending(result)).toBe(true);
    next.resolve(2);
    await tick();
    expect(result.read()).toBe(2);
    expect(calls).toBe(2);
  });

  it("preserves null values and checks TTL on reads", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100);
    try {
      const options = { cache: { key: ["null-ttl"], ttl: 10 } };
      expect(awaited(() => null, options).read()).toBeNull();
      expect(awaited(() => 3, options).read()).toBeNull();
      now.mockReturnValue(111);
      expect(awaited(() => 3, options).read()).toBe(3);
    } finally {
      now.mockRestore();
    }
  });
});

it("revalidates active consumers together and ignores unrelated invalidations", async () => {
  let calls = 0;
  const options = { cache: { key: ["active-revalidation"], ttl: 60000, tags: ["active-record"] } };
  const first = awaited(async () => ++calls, options);
  const second = awaited(async () => ++calls, options);
  await tick();
  invalidate("unrelated-record");
  await tick();
  expect(calls).toBe(1);
  invalidate("active-record");
  await tick();
  expect(calls).toBe(2);
  expect(first.read()).toBe(2);
  expect(second.read()).toBe(2);
});

it("does not accept dependencies learned from a response older than a committed change", async () => {
  const { operationResult } = await import("../src/core/query-cache");
  const response = deferred<ReturnType<typeof operationResult<number>>>();
  let calls = 0;
  const value = awaited(
    () =>
      ++calls === 1
        ? response.promise
        : operationResult(2, { expires: Date.now() + 60000, tags: ["newly-learned"] }),
    { key: () => ["late-dependencies"] },
  );
  invalidate("newly-learned");
  response.resolve(operationResult(1, { expires: Date.now() + 60000, tags: ["newly-learned"] }));
  await tick();
  await tick();
  expect(value.read()).toBe(2);
  expect(calls).toBe(2);
});

it("replays committed changes and recovers a missed revision with full invalidation", async () => {
  const { connectInvalidations } = await import("../src/addons/query");
  const controller = deferred<import("../src/addons/query").CommittedChanges>();
  const scope = { replayFrom: 7, invalidate: vi.fn(), invalidateAll: vi.fn() };
  const read = vi.fn((_after: number, _signal: AbortSignal) => controller.promise);
  const disconnect = connectInvalidations(read, { scope, interval: 1000 });
  await tick();
  expect(read.mock.calls[0][0]).toBe(7);
  controller.resolve({ revision: 20, reset: true, tags: [] });
  await tick();
  expect(scope.invalidateAll).toHaveBeenCalledTimes(1);
  disconnect();
  expect(read.mock.calls[0][1].aborted).toBe(true);
});

it("expires a retained result when an existing binding is next read", async () => {
  const cache = new ResultCache();
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  let calls = 0;
  const value = awaited(() => ++calls, { cache: { key: "expiry", ttl: 100 }, resultCache: cache });
  expect(value.read()).toBe(1);
  now.mockReturnValue(1101);
  expect(value.read()).toBe(2);
  expect(calls).toBe(2);
  now.mockRestore();
});

it("does not miss invalidation delivered before a transferred owner activates", async () => {
  const { withSeed } = await import("../src/core/transfer");
  const cache = new ResultCache();
  cache.invalidate("seeded", 8);
  let calls = 0;
  const value = withSeed(
    {
      values: { initial: "old" },
      cache: {
        initial: { key: "late-seed", expires: Date.now() + 60000, tags: ["seeded"], revision: 7 },
      },
    },
    () =>
      awaited(
        () => {
          calls++;
          return "new";
        },
        { id: "initial", key: () => "late-seed", resultCache: cache },
      ),
  );
  await tick();
  expect(value.read()).toBe("new");
  expect(calls).toBe(1);
});
