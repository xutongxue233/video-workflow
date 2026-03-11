import { describe, expect, it, vi } from "vitest";

import {
  WORKFLOW_DEFAULT_TEAM_ID,
  WORKFLOW_DEFAULT_TEAM_NAME,
  ensureWorkflowProjectExists,
} from "./workflow-project";

describe("workflow-project helper", () => {
  it("upserts default team and project for given projectId", async () => {
    const teamUpsert = vi.fn().mockResolvedValue({});
    const projectUpsert = vi.fn().mockResolvedValue({});

    await ensureWorkflowProjectExists(
      {
        team: { upsert: teamUpsert },
        project: { upsert: projectUpsert },
      } as never,
      "  proj_demo  ",
    );

    expect(teamUpsert).toHaveBeenCalledWith({
      where: { id: WORKFLOW_DEFAULT_TEAM_ID },
      update: {},
      create: {
        id: WORKFLOW_DEFAULT_TEAM_ID,
        name: WORKFLOW_DEFAULT_TEAM_NAME,
      },
    });
    expect(projectUpsert).toHaveBeenCalledWith({
      where: { id: "proj_demo" },
      update: {},
      create: {
        id: "proj_demo",
        teamId: WORKFLOW_DEFAULT_TEAM_ID,
        name: "proj_demo",
      },
    });
  });

  it("throws when projectId is empty", async () => {
    const teamUpsert = vi.fn();
    const projectUpsert = vi.fn();

    await expect(
      ensureWorkflowProjectExists(
        {
          team: { upsert: teamUpsert },
          project: { upsert: projectUpsert },
        } as never,
        "   ",
      ),
    ).rejects.toThrow("projectId is required");

    expect(teamUpsert).not.toHaveBeenCalled();
    expect(projectUpsert).not.toHaveBeenCalled();
  });
});

