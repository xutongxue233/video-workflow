import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectCreate, projectUpdate, projectUpsert } = vi.hoisted(() => ({
  projectCreate: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpsert: vi.fn(),
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
    },
  },
}));
vi.mock("@/lib/projects/workflow-project", () => ({
  ensureWorkflowProjectExists,
  ensureWorkflowTeamExists,
  WORKFLOW_DEFAULT_TEAM_ID,
}));

import { POST } from "./route";

describe("/api/projects route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
