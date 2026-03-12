import { type PrismaClient, RenderJobStatus } from "@prisma/client";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";
import type { RenderReferenceAsset } from "./render-job.types";

import type {
  CreateQueuedJobInput,
  CreateQueuedJobResult,
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
  referenceAssetsJson: string | null;
  video?: {
    url: string;
  } | null;
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
    videoUrl: record.video?.url ?? null,
    referenceAssets: parseReferenceAssetsJson(record.referenceAssetsJson),
  };
}

function parseReferenceAssetsJson(raw: string | null): RenderReferenceAsset[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: RenderReferenceAsset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const projectId = typeof candidate.projectId === "string" ? candidate.projectId.trim() : "";
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      const fileNameRaw = candidate.fileName;
      const fileName =
        typeof fileNameRaw === "string"
          ? fileNameRaw
          : fileNameRaw == null
            ? null
            : String(fileNameRaw);

      if (!id || !projectId || !url) {
        continue;
      }

      normalized.push({
        id,
        projectId,
        fileName,
        url,
      });
    }

    return normalized;
  } catch {
    return [];
  }
}

function isIdempotencyUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  if (code !== "P2002") {
    return false;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;

  if (Array.isArray(target)) {
    return target.includes("idempotencyKey");
  }

  return target === "idempotencyKey";
}

export function createPrismaRenderJobRepository(
  prisma: PrismaClient = defaultPrisma,
): RenderJobRepository {
  async function findByIdempotencyKeyRaw(idempotencyKey: string) {
    return prisma.renderJob.findUnique({
      where: { idempotencyKey },
      include: {
        video: {
          select: {
            url: true,
          },
        },
      },
    });
  }

  return {
    async createQueuedJob(input: CreateQueuedJobInput): Promise<CreateQueuedJobResult> {
      await ensureWorkflowProjectExists(prisma, input.projectId);
      const existing = await findByIdempotencyKeyRaw(input.idempotencyKey);

      if (existing) {
        return {
          record: mapRecord(existing),
          created: false,
        };
      }

      try {
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
            referenceAssetsJson:
              input.referenceAssets && input.referenceAssets.length > 0
                ? JSON.stringify(input.referenceAssets)
                : null,
          },
        });

        return {
          record: mapRecord(record),
          created: true,
        };
      } catch (error) {
        if (isIdempotencyUniqueConstraintError(error)) {
          const record = await findByIdempotencyKeyRaw(input.idempotencyKey);

          if (record) {
            return {
              record: mapRecord(record),
              created: false,
            };
          }
        }

        throw error;
      }
    },

    async findById(jobId: string): Promise<RenderJobRecord | null> {
      const record = await prisma.renderJob.findUnique({
        where: { id: jobId },
        include: {
          video: {
            select: {
              url: true,
            },
          },
        },
      });

      if (!record) {
        return null;
      }

      return mapRecord(record);
    },

    async findByIdempotencyKey(idempotencyKey: string): Promise<RenderJobRecord | null> {
      const record = await findByIdempotencyKeyRaw(idempotencyKey);

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
