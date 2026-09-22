import { describe, expect, it } from "vitest";
import { mutation, effect, Publr } from "../src/publr";
import { deferred, tick } from "./helpers";

describe("mutation", () => {
  it("starts idle, tracks status, and shares overlapping calls without repeating writes", async () => {
    const request = deferred<string>();
    const argumentsSeen: string[] = [];
    const write = mutation((name: string) => {
      argumentsSeen.push(name);
      return request.promise;
    });
    const pending: boolean[] = [];
    const stop = effect(() => {
      pending.push(write.isPending);
    });
    await tick();
    expect(argumentsSeen).toEqual([]);
    expect(typeof write).toBe("function");
    expect("run" in write).toBe(false);
    expect(write.value).toBeUndefined();
    const first = write("Ada");
    expect(write.isPending).toBe(true);
    expect(write("Elena")).toBe(first);
    await tick();
    expect(argumentsSeen).toEqual(["Ada"]);
    request.resolve("saved");
    expect(await first).toBe("saved");
    await tick();
    expect(write.value).toBe("saved");
    expect(pending).toEqual([false, true, false]);
    stop();
  });

  it("captures thrown errors, clears them on retry, and retains the last success", async () => {
    const failure = new Error("Write failed");
    const write = mutation((value: string) => {
      if (value === "fail") throw failure;
      return value;
    });
    await write("first");
    expect(await write("fail")).toBeUndefined();
    expect(write.error).toBe(failure);
    expect(write.isError).toBe(true);
    expect(write.value).toBe("first");
    const retry = write("second");
    expect(write.error).toBeUndefined();
    expect(write.isError).toBe(false);
    await retry;
    expect(write.value).toBe("second");
  });

  it("observes promise rejection without an unhandled rejection", async () => {
    const write = mutation(() => Promise.reject("offline"));
    await write();
    expect(write.error).toBe("offline");
    expect(write.isPending).toBe(false);
  });

  it("does not publish late results or start new writes after owner disposal", async () => {
    const { createScope, runInScope, disposeScope } = Publr._internals;
    const scope = createScope();
    const request = deferred<number>();
    let calls = 0;
    const write = runInScope(scope, () =>
      mutation(() => {
        calls++;
        return request.promise;
      }),
    );
    const pending = write();
    await tick();
    disposeScope(scope);
    request.resolve(3);
    await pending;
    expect(write.value).toBeUndefined();
    await write();
    expect(calls).toBe(1);
  });
});
