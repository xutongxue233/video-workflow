import { type PrismaClient, RenderJobStatus } from "@prisma/client";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";

import type {
  CreateQueuedJobInput,
  RenderJobRecord,
  RenderJobRepository,
} from "./render-job.service";

function mapRecord(record: {
  id: string;
  projectId: string;
  templateId: string;
  scriptId: string | null;
  voiceStyle: string;
  aspectRatio: string;
  provider: string | null;
  externalJobId: string | null;
  externalStatus: string | null;
  attemptCount: number;
  status: RenderJobStatus;
  idempotencyKey: string;
  errorMessage: string | null;
}): RenderJobRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    templateId: record.templateId,
    scriptId: record.scriptId,
    voiceStyle: record.voiceStyle,
    aspectRatio: record.aspectRatio,
    provider: record.provider,
    externalJobId: record.externalJobId,
    externalStatus: record.externalStatus,
    attemptCount: record.attemptCount,
    status: record.status,
    idempotencyKey: record.idempotencyKey,
    errorMessage: record.errorMessage,
  };
}

export function createPrismaRenderJobRepository(
  prisma: PrismaClient = defaultPrisma,
): RenderJobRepository {
  return {
    async createQueuedJob(input: CreateQueuedJobInput): Promise<RenderJobRecord> {
      await ensureWorkflowProjectExists(prisma, input.projectId);

      const record = await prisma.renderJob.create({
        data: {
          projectId: input.projectId,
          scriptId: input.scriptId,
          templateId: input.templateId,
          voiceStyle: input.voiceStyle,
          aspectRatio: input.aspectRatio,
          provider: input.provider,
          status: RenderJobStatus.QUEUED,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return mapRecord(record);
    },

    async findById(jobId: string): Promise<RenderJobRecord | null> {
      const record = await prisma.renderJob.findUnique({
        where: { id: jobId },
      });

      if (!record) {
        return null;
      }

      return mapRecord(record);
    },

    async markRunning(jobId: string): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: RenderJobStatus.RUNNING,
          startedAt: new Date(),
        },
      });
    },

    async markSucceeded(jobId: string): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: RenderJobStatus.SUCCEEDED,
          finishedAt: new Date(),
        },
      });
    },

    async markFailed(jobId: string, errorMessage: string): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: RenderJobStatus.FAILED,
          errorMessage,
          finishedAt: new Date(),
        },
      });
    },

    async incrementAttemptCount(jobId: string): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });
    },

    async setExternalJob(
      jobId: string,
      input: { provider: string; externalJobId: string; externalStatus: string },
    ): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          provider: input.provider,
          externalJobId: input.externalJobId,
          externalStatus: input.externalStatus,
        },
      });
    },

    async setExternalStatus(jobId: string, externalStatus: string): Promise<void> {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          externalStatus,
        },
      });
    },

    async getScriptStructuredJson(scriptId: string): Promise<string | null> {
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
          structuredJson: true,
        },
      });

      return script?.structuredJson ?? null;
    },

    async createVideoFromExternalJob(input: {
      jobId: string;
      projectId: string;
      externalJobId: string;
      videoUrl: string;
      width?: number;
      height?: number;
      durationSeconds?: number;
    }): Promise<void> {
      await ensureWorkflowProjectExists(prisma, input.projectId);

      await prisma.video.create({
        data: {
          projectId: input.projectId,
          renderJobId: input.jobId,
          storageKey: `external://seadance/${input.externalJobId}`,
          url: input.videoUrl,
          width: input.width,
          height: input.height,
          durationSeconds: input.durationSeconds,
        },
      });
    },
  };
}
