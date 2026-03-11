import { buildRenderJobIdempotencyKey, buildRenderPayload } from "./render-job";
import type { RenderPayload, RenderPayloadInput } from "./render-job.types";

export type CreateQueuedJobInput = RenderPayload & {
  idempotencyKey: string;
};

export type RenderJobRecord = {
  id: string;
  projectId: string;
  templateId: string;
  scriptId?: string | null;
  voiceStyle: string;
  aspectRatio: string;
  provider?: string | null;
  externalJobId?: string | null;
  externalStatus?: string | null;
  attemptCount?: number;
  status: string;
  idempotencyKey: string;
  errorMessage?: string | null;
  videoUrl?: string | null;
};

export type RenderJobDto = RenderJobRecord;

export type RenderJobRepository = {
  createQueuedJob(input: CreateQueuedJobInput): Promise<RenderJobRecord>;
  findById(jobId: string): Promise<RenderJobRecord | null>;
  markRunning(jobId: string): Promise<void>;
  markSucceeded(jobId: string): Promise<void>;
  markFailed(jobId: string, errorMessage: string): Promise<void>;
  incrementAttemptCount(jobId: string): Promise<void>;
  setExternalJob(
    jobId: string,
    input: { provider: string; externalJobId: string; externalStatus: string },
  ): Promise<void>;
  setExternalStatus(jobId: string, externalStatus: string): Promise<void>;
  getScriptStructuredJson(scriptId: string): Promise<string | null>;
  createVideoFromExternalJob(input: {
    jobId: string;
    projectId: string;
    externalJobId: string;
    videoUrl: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
  }): Promise<void>;
};

export type RenderQueuePort = {
  enqueue(payload: RenderPayload, idempotencyKey: string): Promise<void>;
};

export function createRenderJobService(deps: {
  repository: RenderJobRepository;
  queue: RenderQueuePort;
}) {
  return {
    async create(input: RenderPayloadInput): Promise<RenderJobDto> {
      const payload = buildRenderPayload(input);
      const idempotencyKey = buildRenderJobIdempotencyKey(payload);

      const record = await deps.repository.createQueuedJob({
        ...payload,
        idempotencyKey,
      });

      await deps.queue.enqueue(payload, idempotencyKey);

      return record;
    },

    async getById(jobId: string): Promise<RenderJobDto | null> {
      return deps.repository.findById(jobId);
    },
  };
}
