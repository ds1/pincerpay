import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { PACKAGE_VERSION } from "../version.js";

describe("PACKAGE_VERSION", () => {
  it("matches package.json (was hard-coded to 0.1.0)", () => {
    const pkg = createRequire(import.meta.url)("../../package.json") as { version: string };
    expect(PACKAGE_VERSION).toBe(pkg.version);
    expect(PACKAGE_VERSION).not.toBe("0.1.0");
  });
});
