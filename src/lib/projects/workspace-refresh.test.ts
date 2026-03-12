import { describe, expect, it } from "vitest";

import {
  buildProjectScopedAssetsUrl,
  filterMaterialAssetsByProject,
  type MaterialAssetRecord,
} from "./workspace-refresh";

describe("workspace refresh helpers", () => {
  it("builds project scoped assets url", () => {
    expect(buildProjectScopedAssetsUrl("proj_alpha", 120)).toBe("/api/assets?projectId=proj_alpha&limit=120");
  });

  it("filters materials by active project id", () => {
    const input: MaterialAssetRecord[] = [
      { id: "a1", projectId: "proj_alpha", fileName: "a.png", url: "/api/files/a.png", createdAt: "2026-03-12T00:00:00.000Z" },
      { id: "b1", projectId: "proj_beta", fileName: "b.png", url: "/api/files/b.png", createdAt: "2026-03-12T00:00:00.000Z" },
    ];

    expect(filterMaterialAssetsByProject(input, "proj_alpha")).toEqual([input[0]]);
  });
});
