import type { PrismaClient } from "@prisma/client";

export const WORKFLOW_DEFAULT_TEAM_ID = "team_video_workflow_default";
export const WORKFLOW_DEFAULT_TEAM_NAME = "Video Workflow";

export class DeletedProjectError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`project ${projectId} has been deleted`);
    this.name = "DeletedProjectError";
    this.projectId = projectId;
  }
}

export function isDeletedProjectError(error: unknown): error is DeletedProjectError {
  return error instanceof DeletedProjectError;
}

export async function ensureWorkflowTeamExists(prisma: PrismaClient): Promise<void> {
  await prisma.team.upsert({
    where: { id: WORKFLOW_DEFAULT_TEAM_ID },
    update: {},
    create: {
      id: WORKFLOW_DEFAULT_TEAM_ID,
      name: WORKFLOW_DEFAULT_TEAM_NAME,
    },
  });
}

export async function ensureWorkflowProjectExists(
  prisma: PrismaClient,
  projectId: string,
  options?: { allowDeleted?: boolean },
): Promise<void> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("projectId is required");
  }

  const existing = await prisma.project.findUnique({
    where: { id: normalizedProjectId },
    select: { deletedAt: true },
  });

  if (existing) {
    if (existing.deletedAt && !options?.allowDeleted) {
      throw new DeletedProjectError(normalizedProjectId);
    }
    return;
  }

  await ensureWorkflowTeamExists(prisma);

  await prisma.project.create({
    data: {
      id: normalizedProjectId,
      teamId: WORKFLOW_DEFAULT_TEAM_ID,
      name: normalizedProjectId,
    },
  });
}

