import type { PrismaClient } from "@prisma/client";

export const WORKFLOW_DEFAULT_TEAM_ID = "team_video_workflow_default";
export const WORKFLOW_DEFAULT_TEAM_NAME = "Video Workflow";

export async function ensureWorkflowProjectExists(
  prisma: PrismaClient,
  projectId: string,
): Promise<void> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("projectId is required");
  }

  await prisma.team.upsert({
    where: { id: WORKFLOW_DEFAULT_TEAM_ID },
    update: {},
    create: {
      id: WORKFLOW_DEFAULT_TEAM_ID,
      name: WORKFLOW_DEFAULT_TEAM_NAME,
    },
  });

  await prisma.project.upsert({
    where: { id: normalizedProjectId },
    update: {},
    create: {
      id: normalizedProjectId,
      teamId: WORKFLOW_DEFAULT_TEAM_ID,
      name: normalizedProjectId,
    },
  });
}

