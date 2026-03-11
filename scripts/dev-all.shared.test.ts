import { describe, expect, it } from "vitest";

import { buildNpmSpawnSpec } from "./dev-all.shared.mjs";

describe("buildNpmSpawnSpec", () => {
  it("uses cmd.exe on win32", () => {
    const spec = buildNpmSpawnSpec("worker", "win32");

    expect(spec.command).toBe("cmd.exe");
    expect(spec.args).toEqual(["/d", "/s", "/c", "npm run worker"]);
  });

  it("uses npm binary on non-win32", () => {
    const spec = buildNpmSpawnSpec("dev", "linux");

    expect(spec.command).toBe("npm");
    expect(spec.args).toEqual(["run", "dev"]);
  });
});