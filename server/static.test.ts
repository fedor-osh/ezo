import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { resolveSafe } from "./static.ts";

const root = resolve("/srv/dist");

describe("resolveSafe", () => {
  it("resolves files inside the root", () => {
    expect(resolveSafe(root, "/assets/app-123.js?v=1")).toBe(join(root, "assets/app-123.js"));
    expect(resolveSafe(root, "/")).toBe(root);
  });

  it("refuses traversal and malformed paths", () => {
    expect(resolveSafe(root, "/../etc/passwd")).toBeNull();
    expect(resolveSafe(root, "/%2e%2e/etc/passwd")).toBeNull();
    expect(resolveSafe(root, "/assets/%2e%2e%2f%2e%2e%2fsecret")).toBeNull();
    expect(resolveSafe(root, "/%E0%A4%A")).toBeNull();
    expect(resolveSafe(root, "/a%00b")).toBeNull();
    expect(resolveSafe(root, "/../dist-other/x")).toBeNull();
  });
});
