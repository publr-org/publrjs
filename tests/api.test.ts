import { afterEach, describe, expect, it, vi } from "vitest";
import { answered, pages, Refused, send } from "../src/core/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("answers the operation's result, with meta beside it when asked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: { id: "a" }, meta: { next: "b" } }),
      })),
    );
    expect(await send("notes.get", { id: "a" })).toEqual({ id: "a" });
    expect((await answered("notes.get", { id: "a" })).meta.next).toBe("b");
  });

  it("walks every page until next is empty, asking after the last", async () => {
    const asked: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_address: string, init: RequestInit) => {
        const input = JSON.parse(init.body as string);
        asked.push(input.after ?? "");
        const next = input.after ? "" : "p1";
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { names: [input.after ?? "first"] }, meta: { next } }),
        };
      }),
    );
    const seen: unknown[] = [];
    for await (const page of pages<{ names: string[] }>("operation.list", {}))
      seen.push(...page.names);
    expect(seen).toEqual(["first", "p1"]);
    expect(asked).toEqual(["", "p1"]);
  });

  it("refuses with the server's code and problems", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        json: async () => ({
          error: "Invalid",
          problems: [{ field: "tags", message: "At most 20" }],
        }),
      })),
    );
    await expect(send("notes.tag", { tags: [] })).rejects.toBeInstanceOf(Refused);
  });
});
