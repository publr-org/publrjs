// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { needsBase, path, url } from "../src/core/base";

describe("base path", () => {
  afterEach(() => document.documentElement.removeAttribute("data-publr-base"));

  it("puts a root path under the base once", () => {
    expect(needsBase("/environments/dev", "/admin")).toBe(true);
    expect(needsBase("/environments/dev", "/environments/devx")).toBe(true);
    expect(needsBase("/environments/dev", "/environments/dev/admin")).toBe(false);
    expect(needsBase("/environments/dev", "/environments/dev?x=1")).toBe(false);
    expect(needsBase("/environments/dev", "//cdn.example/a.js")).toBe(false);
    expect(needsBase("/environments/dev", "https://example.com/")).toBe(false);
    expect(needsBase("/environments/dev", "#top")).toBe(false);
    expect(needsBase("", "/admin")).toBe(false);
  });

  it("reads the base the page states", () => {
    expect(url("/api/records")).toBe("/api/records");
    document.documentElement.setAttribute("data-publr-base", "/environments/dev");
    expect(url("/api/records")).toBe("/environments/dev/api/records");
    expect(url("/environments/dev/admin")).toBe("/environments/dev/admin");
  });

  it("takes the base back off a path the browser shows", () => {
    document.documentElement.setAttribute("data-publr-base", "/environments/dev");
    expect(path("/environments/dev/admin")).toBe("/admin");
    expect(path("/environments/dev")).toBe("/");
    expect(path("/environments/devx")).toBe("/environments/devx");
    expect(path("/admin")).toBe("/admin");
  });
});
