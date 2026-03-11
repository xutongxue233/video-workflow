import { Worker, type Job } from "bullmq";

import { RENDER_QUEUE_NAME } from "../lib/queue/queue.constants";
import { getBullMQConnectionOptions } from "../lib/queue/redis";
import { createPrismaRenderJobRepository } from "../lib/render/render-job.repository";
import type { RenderJobRepository } from "../lib/render/render-job.service";
import type { RenderPayload } from "../lib/render/render-job.types";
import {
  createGoogleCompatibleVideoClient,
  createGoogleVideoService,
} from "../lib/video/google-video.service";
import {
  createOpenAICompatibleSeaDanceClient,
  createSeaDanceVideoService,
  type SeaDanceStatus,
} from "../lib/video/seadance-video.service";

type VideoGenerationService = {
  generateVideo(input: {
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    imageUrls: string[];
  }): Promise<{
    externalJobId: string;
    status: SeaDanceStatus;
    videoUrl?: string;
  }>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown render pipeline error";
}

function buildVideoPrompt(structuredJson: string, voiceStyle: string): string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(structuredJson);
  } catch {
    return `Generate a promo video with voice style ${voiceStyle}.`;
  }

  if (!parsed || typeof parsed !== "object") {
    return `Generate a promo video with voice style ${voiceStyle}.`;
  }

  const obj = parsed as {
    title?: string;
    hook?: string;
    cta?: string;
    shots?: Array<{ visual?: string; caption?: string; camera?: string }>;
  };

  const shotLines =
    obj.shots?.
      map((shot, index) => `${index + 1}. ${shot.visual ?? ""} | ${shot.caption ?? ""} | ${shot.camera ?? ""}`)
      .join("\n") ?? "";

  return [
    `Title: ${obj.title ?? "Untitled"}`,
    `Hook: ${obj.hook ?? ""}`,
    `Voice style: ${voiceStyle}`,
    "Storyboard:",
    shotLines,
    `CTA: ${obj.cta ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

let cachedVideoService: VideoGenerationService | null = null;
const runtimeVideoServiceCache = new Map<string, VideoGenerationService>();

function getPollConfig() {
  return {
    pollIntervalMs: Number(process.env.VIDEO_POLL_INTERVAL_MS ?? process.env.SEADANCE_POLL_INTERVAL_MS ?? 2000),
    pollTimeoutMs: Number(process.env.VIDEO_POLL_TIMEOUT_MS ?? process.env.SEADANCE_POLL_TIMEOUT_MS ?? 120000),
  };
}

function getDefaultVideoService(): VideoGenerationService {
  if (cachedVideoService) {
    return cachedVideoService;
  }

  const baseURL = process.env.SEADANCE_BASE_URL;
  const apiKey = process.env.SEADANCE_API_KEY;
  const model = process.env.SEADANCE_VIDEO_MODEL;

  if (!baseURL || !apiKey || !model) {
    throw new Error("Missing SEADANCE_BASE_URL, SEADANCE_API_KEY, or SEADANCE_VIDEO_MODEL");
  }

  const pollConfig = getPollConfig();
  cachedVideoService = createSeaDanceVideoService({
    client: createOpenAICompatibleSeaDanceClient({
      baseURL,
      apiKey,
    }),
    model,
    pollIntervalMs: pollConfig.pollIntervalMs,
    pollTimeoutMs: pollConfig.pollTimeoutMs,
  });

  return cachedVideoService;
}

function getRuntimeVideoService(payload: RenderPayload): VideoGenerationService | null {
  const selectedVideoModel = payload.selectedVideoModel;

  if (!selectedVideoModel) {
    return null;
  }

  const cacheKey = [
    selectedVideoModel.protocol,
    selectedVideoModel.baseURL,
    selectedVideoModel.modelId,
  ].join("|");
  const cachedService = runtimeVideoServiceCache.get(cacheKey);

  if (cachedService) {
    return cachedService;
  }

  const pollConfig = getPollConfig();
  const service =
    selectedVideoModel.protocol === "google"
      ? createGoogleVideoService({
          client: createGoogleCompatibleVideoClient({
            baseURL: selectedVideoModel.baseURL,
            apiKey: selectedVideoModel.apiKey,
          }),
          model: selectedVideoModel.modelId,
          pollIntervalMs: pollConfig.pollIntervalMs,
          pollTimeoutMs: pollConfig.pollTimeoutMs,
        })
      : createSeaDanceVideoService({
          client: createOpenAICompatibleSeaDanceClient({
            baseURL: selectedVideoModel.baseURL,
            apiKey: selectedVideoModel.apiKey,
          }),
          model: selectedVideoModel.modelId,
          pollIntervalMs: pollConfig.pollIntervalMs,
          pollTimeoutMs: pollConfig.pollTimeoutMs,
        });

  runtimeVideoServiceCache.set(cacheKey, service);
  return service;
}

function getVideoServiceForPayload(payload: RenderPayload): VideoGenerationService {
  return getRuntimeVideoService(payload) ?? getDefaultVideoService();
}

export function createRenderJobProcessor(deps: {
  repository: RenderJobRepository;
  videoService: VideoGenerationService;
}) {
  return async function process(input: Pick<Job<RenderPayload>, "id" | "data">): Promise<void> {
    const jobId = input.id?.toString();

    if (!jobId) {
      throw new Error("Queue job id is required");
    }

    await deps.repository.incrementAttemptCount(jobId);
    await deps.repository.markRunning(jobId);

    try {
      const structuredJson = await deps.repository.getScriptStructuredJson(input.data.scriptId);

      if (!structuredJson) {
        throw new Error(`Structured script JSON not found for scriptId ${input.data.scriptId}`);
      }

      const prompt = buildVideoPrompt(structuredJson, input.data.voiceStyle);

      const generated = await deps.videoService.generateVideo({
        prompt,
        aspectRatio: input.data.aspectRatio,
        imageUrls: [],
      });

      await deps.repository.setExternalJob(jobId, {
        provider: input.data.provider,
        externalJobId: generated.externalJobId,
        externalStatus: generated.status,
      });

      if (generated.status !== "succeeded" || !generated.videoUrl) {
        throw new Error("SeaDance generation did not produce a successful video URL");
      }

      await deps.repository.createVideoFromExternalJob({
        jobId,
        projectId: input.data.projectId,
        externalJobId: generated.externalJobId,
        videoUrl: generated.videoUrl,
      });

      await deps.repository.markSucceeded(jobId);
    } catch (error) {
      await deps.repository.markFailed(jobId, toErrorMessage(error));
      throw error;
    }
  };
}

export async function processRenderQueueJob(job: Job<RenderPayload>) {
  const processor = createRenderJobProcessor({
    repository: createPrismaRenderJobRepository(),
    videoService: getVideoServiceForPayload(job.data),
  });

  await processor(job);
}

export function startRenderWorker() {
  const worker = new Worker<RenderPayload>(RENDER_QUEUE_NAME, processRenderQueueJob, {
    connection: getBullMQConnectionOptions(),
    concurrency: Number(process.env.RENDER_WORKER_CONCURRENCY ?? 1),
  });

  worker.on("ready", () => {
    console.log("[render-worker] ready");
  });

  worker.on("failed", (job, error) => {
    console.error(`[render-worker] failed job ${job?.id ?? "unknown"}:`, error.message);
  });

  return worker;
}

if (
  process.env.DISABLE_RENDER_WORKER_AUTO_START !== "true" &&
  process.env.NODE_ENV !== "test"
) {
  startRenderWorker();
}
