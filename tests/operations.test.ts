import { afterEach, describe, expect, it, vi } from "vitest";
import { call, groq, query, send } from "../src/addons/operations";
import { tick } from "./helpers";

const answered = (body: unknown, ok = true, status = 200) =>
  vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { publr?: unknown }).publr;
  document.head.innerHTML = "";
});

describe("operations", () => {
  it("posts an operation to its /api address with the page's token", async () => {
    document.head.innerHTML = '<meta name="publr-csrf" content="token-1">';
    const fetched = answered({ id: "a1" });
    vi.stubGlobal("fetch", fetched);
    expect(await send("lms.add_chapter", { title: "Going live" })).toEqual({ id: "a1" });
    const [address, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("/api/lms/add_chapter");
    expect((init.headers as Record<string, string>)["X-Csrf-Token"]).toBe("token-1");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Going live" });
  });

  it("goes through the frame's bridge when there is one, never to the network", async () => {
    const fetched = answered({});
    vi.stubGlobal("fetch", fetched);
    const asked: unknown[] = [];
    (globalThis as { publr?: unknown }).publr = {
      call: async (operation: string, input: unknown) => {
        asked.push([operation, input]);
        return { position: 2 };
      },
    };
    const move = call<{ id: string; position: number }, { position: number }>("lms.move_chapter");
    expect(await move({ id: "c1", position: 2 })).toEqual({ position: 2 });
    expect(asked).toEqual([["lms.move_chapter", { id: "c1", position: 2 }]]);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("refuses with the server's message", async () => {
    vi.stubGlobal("fetch", answered({ error: "invalid_input", message: "Too long" }, false, 422));
    const save = call("lms.set_course");
    expect(await save({ title: "x".repeat(200) })).toBeUndefined();
    expect((save.error as Error).message).toBe("Too long");
  });

  it("reads GROQ through record.query and refetches a read after a write", async () => {
    let reads = 0;
    const fetched = vi.fn(async (address: string) => {
      if (address === "/api/record/query") reads += 1;
      const body = address === "/api/record/query" ? { result: [{ title: `read ${reads}` }] } : {};
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetched);
    const drafts = query<Array<{ title: string }>>(groq`*[_type == "chapter"]{ title }`);
    for (let index = 0; index < 5 && drafts.value === undefined; index += 1) await tick();
    expect(drafts.value).toEqual([{ title: "read 1" }]);
    const [, init] = fetched.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).query).toBe('*[_type == "chapter"]{ title }');
    await call("lms.add_chapter")({ title: "Going live" });
    for (let index = 0; index < 5 && reads < 2; index += 1) await tick();
    expect(reads).toBe(2);
  });
});

declare module "../src/addons/operations" {
  interface Operations {
    "lms.move_chapter": { in: { id: string; position: number }; out: { position: number } };
  }
}

describe("operations' types", () => {
  it("checks a named operation's input and output", () => {
    const move = call("lms.move_chapter");
    // @ts-expect-error a field the operation does not take
    const wrong = () => move({ id: "c1", postion: 2 });
    const right = async () => (await move({ id: "c1", position: 2 }))?.position;
    expect(typeof wrong).toBe("function");
    expect(typeof right).toBe("function");
  });
});

describe("seeded reads", () => {
  it("reads nothing on load, and reads once a write makes it stale", async () => {
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string) => {
        if (address === "/api/notes/list") reads += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ entries: [] }),
        } as unknown as Response;
      }),
    );
    const listed = query("notes.list", undefined, { seeded: true });
    for (let index = 0; index < 5; index += 1) await tick();
    expect(listed.value).toBeUndefined();
    expect(reads).toBe(0);
    await call("notes.add")({ title: "x" });
    for (let index = 0; index < 5 && reads < 1; index += 1) await tick();
    expect(reads).toBe(1);
  });
});
