import { describe, expect, it, vi } from "vitest";

import {
  DeletedProjectError,
  WORKFLOW_DEFAULT_TEAM_ID,
  WORKFLOW_DEFAULT_TEAM_NAME,
  ensureWorkflowTeamExists,
  ensureWorkflowProjectExists,
} from "./workflow-project";

describe("workflow-project helper", () => {
  it("upserts default team", async () => {
    const teamUpsert = vi.fn().mockResolvedValue({});

    await ensureWorkflowTeamExists(
      {
        team: { upsert: teamUpsert },
      } as never,
    );

    expect(teamUpsert).toHaveBeenCalledWith({
      where: { id: WORKFLOW_DEFAULT_TEAM_ID },
      update: {},
      create: {
        id: WORKFLOW_DEFAULT_TEAM_ID,
        name: WORKFLOW_DEFAULT_TEAM_NAME,
      },
    });
  });

  it("creates default team and project for given projectId when project does not exist", async () => {
    const teamUpsert = vi.fn().mockResolvedValue({});
    const projectFindUnique = vi.fn().mockResolvedValue(null);
    const projectCreate = vi.fn().mockResolvedValue({});

    await ensureWorkflowProjectExists(
      {
        team: { upsert: teamUpsert },
        project: {
          findUnique: projectFindUnique,
          create: projectCreate,
        },
      } as never,
      "  proj_demo  ",
    );

    expect(projectFindUnique).toHaveBeenCalledWith({
      where: { id: "proj_demo" },
      select: { deletedAt: true },
    });
    expect(teamUpsert).toHaveBeenCalledWith({
      where: { id: WORKFLOW_DEFAULT_TEAM_ID },
      update: {},
      create: {
        id: WORKFLOW_DEFAULT_TEAM_ID,
        name: WORKFLOW_DEFAULT_TEAM_NAME,
      },
    });
    expect(projectCreate).toHaveBeenCalledWith({
      data: {
        id: "proj_demo",
        teamId: WORKFLOW_DEFAULT_TEAM_ID,
        name: "proj_demo",
      },
    });
  });

  it("throws when project is soft deleted", async () => {
    const teamUpsert = vi.fn();
    const projectFindUnique = vi.fn().mockResolvedValue({
      deletedAt: new Date("2026-03-12T00:00:00.000Z"),
    });
    const projectCreate = vi.fn();

    await expect(
      ensureWorkflowProjectExists(
        {
          team: { upsert: teamUpsert },
          project: {
            findUnique: projectFindUnique,
            create: projectCreate,
          },
        } as never,
        "proj_archived",
      ),
    ).rejects.toBeInstanceOf(DeletedProjectError);

    expect(teamUpsert).not.toHaveBeenCalled();
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it("allows deleted project when allowDeleted option is true", async () => {
    const teamUpsert = vi.fn();
    const projectFindUnique = vi.fn().mockResolvedValue({
      deletedAt: new Date("2026-03-12T00:00:00.000Z"),
    });
    const projectCreate = vi.fn();

    await ensureWorkflowProjectExists(
      {
        team: { upsert: teamUpsert },
        project: {
          findUnique: projectFindUnique,
          create: projectCreate,
        },
      } as never,
      "proj_archived",
      { allowDeleted: true },
    );

    expect(teamUpsert).not.toHaveBeenCalled();
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it("throws when projectId is empty", async () => {
    const teamUpsert = vi.fn();
    const projectFindUnique = vi.fn();
    const projectCreate = vi.fn();

    await expect(
      ensureWorkflowProjectExists(
        {
          team: { upsert: teamUpsert },
          project: {
            findUnique: projectFindUnique,
            create: projectCreate,
          },
        } as never,
        "   ",
      ),
    ).rejects.toThrow("projectId is required");

    expect(teamUpsert).not.toHaveBeenCalled();
    expect(projectFindUnique).not.toHaveBeenCalled();
    expect(projectCreate).not.toHaveBeenCalled();
  });
});

