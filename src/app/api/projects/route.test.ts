import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectCreate, projectUpdate, projectUpsert, projectFindMany, projectUpdateMany } = vi.hoisted(() => ({
  projectCreate: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpsert: vi.fn(),
  projectFindMany: vi.fn(),
  projectUpdateMany: vi.fn(),
}));
const { ensureWorkflowProjectExists, ensureWorkflowTeamExists, WORKFLOW_DEFAULT_TEAM_ID } = vi.hoisted(() => ({
  ensureWorkflowProjectExists: vi.fn(),
  ensureWorkflowTeamExists: vi.fn(),
  WORKFLOW_DEFAULT_TEAM_ID: "team_video_workflow_default",
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      create: projectCreate,
      update: projectUpdate,
      upsert: projectUpsert,
      findMany: projectFindMany,
      updateMany: projectUpdateMany,
    },
  },
}));
vi.mock("@/lib/projects/workflow-project", () => ({
  ensureWorkflowProjectExists,
  ensureWorkflowTeamExists,
  WORKFLOW_DEFAULT_TEAM_ID,
}));

import { DELETE, GET, POST } from "./route";

describe("/api/projects route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only active projects", async () => {
    const updatedAt = new Date("2026-03-12T10:00:00.000Z");
    projectFindMany.mockResolvedValue([
      {
        id: "proj_active",
        name: "Active",
        description: null,
        updatedAt,
        _count: {
          assets: 0,
          scripts: 0,
          renderJobs: 0,
          videos: 0,
        },
        assets: [],
        scripts: [],
        renderJobs: [],
      },
    ]);

    const request = new Request("http://localhost/api/projects?limit=20", {
      method: "GET",
    });

    const response = await GET(request);
    const json = (await response.json()) as {
      items: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
        },
      }),
    );
    expect(json.items.map((item) => item.id)).toEqual(["proj_active"]);
  });

  it("creates a project with generated id when only title is provided", async () => {
    const updatedAt = new Date("2026-03-12T10:00:00.000Z");
    projectCreate.mockResolvedValue({
      id: "cuid_auto_001",
      name: "新品发布",
      description: null,
      updatedAt,
    });

    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  新品发布  ",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as {
      id: string;
      name: string;
      description: string | null;
      updatedAt: string;
    };

    expect(response.status).toBe(201);
    expect(ensureWorkflowTeamExists).toHaveBeenCalledTimes(1);
    expect(projectCreate).toHaveBeenCalledWith({
      data: {
        teamId: WORKFLOW_DEFAULT_TEAM_ID,
        name: "新品发布",
        description: undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
      },
    });
    expect(json.id).toBe("cuid_auto_001");
    expect(json.name).toBe("新品发布");
  });

  it("upserts project by explicit projectId when projectId is provided", async () => {
    const updatedAt = new Date("2026-03-12T10:00:00.000Z");
    projectUpdate.mockResolvedValue({
      id: "proj_alpha",
      name: "Alpha",
      description: null,
      updatedAt,
    });

    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "  proj_alpha  ",
        name: "Alpha",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(ensureWorkflowProjectExists).toHaveBeenCalledWith(expect.anything(), "proj_alpha");
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "proj_alpha" },
      data: {
        name: "Alpha",
        description: undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
      },
    });
  });

  it("soft deletes project by projectId", async () => {
    projectUpdateMany.mockResolvedValue({ count: 1 });

    const request = new Request("http://localhost/api/projects?projectId=proj_alpha", {
      method: "DELETE",
    });

    const response = await DELETE(request);
    const json = (await response.json()) as {
      projectId: string;
      deleted: boolean;
    };

    expect(response.status).toBe(200);
    expect(projectUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "proj_alpha",
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
    expect(json).toEqual({
      projectId: "proj_alpha",
      deleted: true,
    });
  });
});
