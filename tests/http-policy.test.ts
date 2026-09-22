import { expect, it, vi, afterEach } from "vitest";
import { httpPolicy } from "../src/core/http-policy";
import { operation, registerResponseAdapter, httpOperation } from "../src/transport";
import { awaited } from "../src/runtime";
import { tick } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

it("accounts for Age, Date and response delay instead of restarting max-age", () => {
  const response = new Response("{}", {
    headers: { "Cache-Control": "max-age=60", Date: new Date(100000).toUTCString(), Age: "20" },
  });
  expect(httpPolicy(response, 110000, 115000).expires).toBe(150000);
  expect(
    httpPolicy(new Response("{}", { headers: { "Cache-Control": "max-age=10, max-age=20" } }), 0, 0)
      .expires,
  ).toBe(0);
});

it("distinguishes storage prohibition, validation, private and shared freshness", () => {
  const headers = { "Cache-Control": 'private, no-cache="Set-Cookie", max-age=60, s-maxage=10' };
  const response = new Response("{}", { headers });
  expect(httpPolicy(response, 0, 0)).toMatchObject({
    noStore: false,
    revalidate: true,
    expires: 60000,
  });
  expect(httpPolicy(response, 0, 0, true)).toMatchObject({ noStore: true, expires: 10000 });
  expect(httpPolicy(new Response("{}", { headers: { Vary: "*" } }), 0, 0).noStore).toBe(true);
});

it("never infers policy from application fields or overrides backend no-store", async () => {
  const payload = { data: "ordinary", cache: true, tags: ["payload"], meta: 4 };
  const fetch = vi.fn(
    async () => new Response(JSON.stringify(payload), { headers: { "Cache-Control": "no-store" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const unregister = registerResponseAdapter("/private", (_response, body) => ({
    value: body,
    policy: { noStore: false, expires: Date.now() + 60000 },
  }));
  const options = { cache: { key: ["private-test"], ttl: 60000 } };
  const first = awaited(() => operation("/private", []), options);
  await tick();
  expect(first.read()).toEqual(payload);
  const second = awaited(() => operation("/private", []), options);
  await tick();
  expect(second.read()).toEqual(payload);
  expect(fetch).toHaveBeenCalledTimes(2);
  unregister();
});

it("keeps custom dependencies separate and delegates GET validation to Fetch", async () => {
  const response = new Response("null", { headers: { "Publr-Dependencies": '["record:one"]' } });
  expect(httpPolicy(response, 0, 0).tags).toEqual(["record:one"]);
  const fetch = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetch);
  await httpOperation("/resource")();
  expect(fetch).toHaveBeenCalledWith(
    "/resource",
    expect.objectContaining({ method: "GET", cache: "no-cache" }),
  );
});

it("does not reuse varying POST results under an argument-only key", async () => {
  const request = vi.fn(() =>
    Promise.resolve(
      new Response('{"name":"Ada"}', {
        headers: { "Cache-Control": "max-age=60", Vary: "Cookie" },
      }),
    ),
  );
  vi.stubGlobal("fetch", request);
  const options = { key: () => "vary-cookie-operation" };
  const first = awaited(() => operation<{ name: string }>("/vary", []), options);
  await tick();
  expect(first.read().name).toBe("Ada");
  const second = awaited(() => operation<{ name: string }>("/vary", []), options);
  await tick();
  expect(second.read().name).toBe("Ada");
  expect(request).toHaveBeenCalledTimes(2);
});
