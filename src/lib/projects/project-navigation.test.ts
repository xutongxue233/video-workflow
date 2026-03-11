import { describe, expect, it } from "vitest";

import { WORKFLOW_DEFAULT_PROJECT_ID, buildProjectDetailPath } from "./project-navigation";

describe("project navigation", () => {
  it("builds detail path with trimmed and encoded project id", () => {
    expect(buildProjectDetailPath(" proj alpha/1 ")).toBe("/projects/proj%20alpha%2F1");
  });

  it("falls back to default project id when value is empty", () => {
    expect(buildProjectDetailPath("   ")).toBe(`/projects/${WORKFLOW_DEFAULT_PROJECT_ID}`);
  });
});

