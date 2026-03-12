import { Worker, type Job } from "bullmq";

import { loadEnvFileToProcess } from "../lib/env/load-local-env";
import { mergeRemoteVideos } from "../lib/media/video-merge";
import { RENDER_QUEUE_NAME } from "../lib/queue/queue.constants";
import { getBullMQConnectionOptions } from "../lib/queue/redis";
import { createPrismaRenderJobRepository } from "../lib/render/render-job.repository";
import type { RenderJobRepository } from "../lib/render/render-job.service";
import {
  createStoryboardProgress,
  encodeStoryboardProgress,
  parseStoryboardProgress,
  updateStoryboardProgress,
  type StoryboardProgress,
} from "../lib/render/storyboard-progress";
import type { RenderPayload } from "../lib/render/render-job.types";
import {
  createGoogleCompatibleVideoClient,
  createGoogleVideoService,
} from "../lib/video/google-video.service";
import {
  createOpenAICompatibleSeaDanceClient,
  createSeaDanceVideoService,
  type SeaDanceImageInput,
  type SeaDanceStatus,
} from "../lib/video/seadance-video.service";

loadEnvFileToProcess();

type VideoGenerationService = {
  generateVideo(input: {
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    imageUrls: string[];
    imageInputs?: SeaDanceImageInput[];
    durationSec?: number;
  }): Promise<{
    externalJobId: string;
    status: SeaDanceStatus;
    videoUrl?: string;
  }>;
};

type StoryboardShotInput = {
  shotIndex: number;
  durationSec?: number;
  visual: string;
  caption: string;
  camera: string;
};

type StoryboardSpec = {
  title: string;
  hook: string;
  cta: string;
  shots: StoryboardShotInput[];
};

const PRODUCT_LOCK_CONSTRAINTS = [
  "Strict product lock: the uploaded 3D printed object is immutable identity anchor.",
  "Do NOT change geometry, silhouette, proportions, topology, engraved text/logo, part count, or material layout.",
  "No redesign, substitution, morphing, style-transfer, new parts, missing parts, or text mutation.",
  "If uncertain, keep product unchanged and vary only camera, lighting, background, motion.",
].join(" ");

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown render pipeline error";
}

function extractTimedOutExternalJobId(errorMessage: string): string | null {
  const matched = errorMessage.match(/(?:SeaDance|Google)\s+job\s+(\S+)\s+timed out/i);
  return matched?.[1] ?? null;
}

function parseRetryTargetJobId(queueJobId: string): string | null {
  const matched = queueJobId.match(/^retry:([^:]+):\d+$/);
  return matched?.[1] ?? null;
}

function parseStoryboardSpec(structuredJson: string): StoryboardSpec | null {
  try {
    const parsed = JSON.parse(structuredJson) as {
      title?: unknown;
      hook?: unknown;
      cta?: unknown;
      shots?: Array<{
        index?: unknown;
        durationSec?: unknown;
        visual?: unknown;
        caption?: unknown;
        camera?: unknown;
      }>;
    };

    if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) {
      return null;
    }

    const shots = parsed.shots
      .map((shot, index) => ({
        shotIndex:
          typeof shot.index === "number" && Number.isFinite(shot.index)
            ? Math.max(1, Math.floor(shot.index))
            : index + 1,
        durationSec:
          typeof shot.durationSec === "number" && Number.isFinite(shot.durationSec)
            ? Math.max(1, Math.floor(shot.durationSec))
            : undefined,
        visual: typeof shot.visual === "string" ? shot.visual.trim() : "",
        caption: typeof shot.caption === "string" ? shot.caption.trim() : "",
        camera: typeof shot.camera === "string" ? shot.camera.trim() : "",
      }))
      .filter((shot) => shot.visual.length > 0 || shot.caption.length > 0 || shot.camera.length > 0);

    if (shots.length === 0) {
      return null;
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : "Untitled",
      hook: typeof parsed.hook === "string" ? parsed.hook : "",
      cta: typeof parsed.cta === "string" ? parsed.cta : "",
      shots,
    };
  } catch {
    return null;
  }
}

function formatDurationPrompt(durationSec?: number): string {
  if (durationSec === -1) {
    return "Target duration: auto-select integer seconds in [4,12].";
  }

  if (typeof durationSec === "number" && Number.isFinite(durationSec)) {
    return `Target duration: ${Math.floor(durationSec)} seconds.`;
  }

  return "Target duration: auto.";
}

function isSeedancePayload(payload: RenderPayload): boolean {
  if (payload.selectedVideoModel?.protocol) {
    return payload.selectedVideoModel.protocol === "seedance";
  }

  return /seedance|seadance/i.test(payload.provider);
}

function toSeedanceImageInputs(payload: RenderPayload): SeaDanceImageInput[] {
  const firstFrameUrl =
    typeof payload.firstFrameUrl === "string" && payload.firstFrameUrl.trim().length > 0
      ? payload.firstFrameUrl
      : undefined;
  const lastFrameUrl =
    typeof payload.lastFrameUrl === "string" && payload.lastFrameUrl.trim().length > 0
      ? payload.lastFrameUrl
      : undefined;
  const referenceImageUrls = Array.isArray(payload.referenceImageUrls)
    ? payload.referenceImageUrls.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : [];

  if (firstFrameUrl && lastFrameUrl) {
    return [
      { url: firstFrameUrl, role: "first_frame" },
      { url: lastFrameUrl, role: "last_frame" },
    ];
  }

  if (firstFrameUrl) {
    return [{ url: firstFrameUrl, role: "first_frame" }];
  }

  if (referenceImageUrls.length >= 2) {
    return [
      { url: referenceImageUrls[0], role: "first_frame" },
      { url: referenceImageUrls[1], role: "last_frame" },
    ];
  }

  if (referenceImageUrls.length === 1) {
    return [{ url: referenceImageUrls[0], role: "first_frame" }];
  }

  return [];
}

function buildVideoPrompt(structuredJson: string, voiceStyle: string, durationSec?: number): string {
  let parsed: unknown;
  const durationPrompt = formatDurationPrompt(durationSec);

  try {
    parsed = JSON.parse(structuredJson);
  } catch {
    return [
      `Generate a promo video with voice style ${voiceStyle}.`,
      durationPrompt,
      "Use uploaded product reference images as strict grounding.",
      PRODUCT_LOCK_CONSTRAINTS,
    ].join(" ");
  }

  if (!parsed || typeof parsed !== "object") {
    return [
      `Generate a promo video with voice style ${voiceStyle}.`,
      durationPrompt,
      "Use uploaded product reference images as strict grounding.",
      PRODUCT_LOCK_CONSTRAINTS,
    ].join(" ");
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
    durationPrompt,
    PRODUCT_LOCK_CONSTRAINTS,
    "Storyboard:",
    shotLines,
    `CTA: ${obj.cta ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildShotPrompt(input: {
  storyboard: StoryboardSpec;
  shot: StoryboardShotInput;
  voiceStyle: string;
  durationSec?: number;
}): string {
  return [
    `Title: ${input.storyboard.title}`,
    `Hook: ${input.storyboard.hook}`,
    `Voice style: ${input.voiceStyle}`,
    `Current shot index: ${input.shot.shotIndex}`,
    formatDurationPrompt(input.durationSec),
    PRODUCT_LOCK_CONSTRAINTS,
    "Generate only this shot while preserving object identity across all shots.",
    `Shot visual: ${input.shot.visual}`,
    `Shot caption: ${input.shot.caption}`,
    `Shot camera: ${input.shot.camera}`,
    `CTA: ${input.storyboard.cta}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

async function persistStoryboardProgress(
  repository: RenderJobRepository,
  jobId: string,
  progress: StoryboardProgress,
) {
  await repository.setExternalStatus(jobId, encodeStoryboardProgress(progress));
}

function collectExternalIds(progress: StoryboardProgress): string[] {
  return progress.shots
    .map((shot) => shot.externalJobId ?? "")
    .filter((value) => value.length > 0);
}

let cachedVideoService: VideoGenerationService | null = null;
const runtimeVideoServiceCache = new Map<string, VideoGenerationService>();

function getPollConfig() {
  return {
    pollIntervalMs: Number(process.env.VIDEO_POLL_INTERVAL_MS ?? process.env.SEADANCE_POLL_INTERVAL_MS ?? 2000),
    pollTimeoutMs: Number(process.env.VIDEO_POLL_TIMEOUT_MS ?? process.env.SEADANCE_POLL_TIMEOUT_MS ?? 900000),
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
  return async function processJob(input: Pick<Job<RenderPayload>, "id" | "data">): Promise<void> {
    const queueJobId = input.id?.toString();

    if (!queueJobId) {
      throw new Error("Queue job id is required");
    }

    const retryTargetJobId = parseRetryTargetJobId(queueJobId);
    const resolvedJob =
      (await deps.repository.findById(queueJobId)) ??
      (retryTargetJobId ? await deps.repository.findById(retryTargetJobId) : null) ??
      (deps.repository.findByIdempotencyKey
        ? await deps.repository.findByIdempotencyKey(queueJobId)
        : null);

    if (!resolvedJob) {
      throw new Error(`Render job not found for queue id ${queueJobId}`);
    }

    const jobId = resolvedJob.id;

    try {
      await deps.repository.incrementAttemptCount(jobId);
      await deps.repository.markRunning(jobId);

      const structuredJson = await deps.repository.getScriptStructuredJson(input.data.scriptId);

      if (!structuredJson) {
        throw new Error(`Structured script JSON not found for scriptId ${input.data.scriptId}`);
      }

      const requestedDuration =
        typeof input.data.durationSec === "number" && Number.isFinite(input.data.durationSec)
          ? Math.floor(input.data.durationSec)
          : undefined;
      const referenceImageUrls = Array.isArray(input.data.referenceImageUrls)
        ? input.data.referenceImageUrls.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 8)
        : [];
      const seedanceImageInputs = isSeedancePayload(input.data) ? toSeedanceImageInputs(input.data) : undefined;
      const storyboard = parseStoryboardSpec(structuredJson);

      if (!storyboard || storyboard.shots.length <= 1) {
        const prompt = buildVideoPrompt(structuredJson, input.data.voiceStyle, requestedDuration);
        let generated: Awaited<ReturnType<VideoGenerationService["generateVideo"]>>;

        try {
          generated = await deps.videoService.generateVideo({
            prompt,
            aspectRatio: input.data.aspectRatio,
            imageUrls: referenceImageUrls,
            imageInputs: seedanceImageInputs,
            durationSec: requestedDuration,
          });
        } catch (error) {
          const timeoutExternalJobId = extractTimedOutExternalJobId(toErrorMessage(error));
          if (timeoutExternalJobId) {
            await deps.repository.setExternalJob(jobId, {
              provider: input.data.provider,
              externalJobId: timeoutExternalJobId,
              externalStatus: "running",
            });
            await deps.repository.markRunning(jobId);
            return;
          }
          throw error;
        }

        await deps.repository.setExternalJob(jobId, {
          provider: input.data.provider,
          externalJobId: generated.externalJobId,
          externalStatus: generated.status,
        });

        if (generated.status === "queued" || generated.status === "running") {
          await deps.repository.markRunning(jobId);
          return;
        }

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
        return;
      }

      const existingProgress = parseStoryboardProgress(resolvedJob.externalStatus);
      let progress = createStoryboardProgress({
        shots: storyboard.shots.map((shot) => ({
          shotIndex: shot.shotIndex,
          durationSec: shot.durationSec,
          visual: shot.visual,
        })),
      });

      if (existingProgress) {
        const existingByShotIndex = new Map(existingProgress.shots.map((shot) => [shot.shotIndex, shot]));

        for (const shot of storyboard.shots) {
          const existing = existingByShotIndex.get(shot.shotIndex);
          if (existing?.status === "succeeded" && existing.videoUrl) {
            progress = updateStoryboardProgress(progress, shot.shotIndex, {
              status: "succeeded",
              externalJobId: existing.externalJobId,
              videoUrl: existing.videoUrl,
              errorMessage: undefined,
            });
          }
        }
      }

      await persistStoryboardProgress(deps.repository, jobId, progress);

      const pendingShots = storyboard.shots.filter((shot) => {
        const matched = progress.shots.find((item) => item.shotIndex === shot.shotIndex);
        return matched?.status !== "succeeded" || !matched.videoUrl;
      });

      const shotResults = await Promise.all(
        pendingShots.map(async (shot) => {
          progress = updateStoryboardProgress(progress, shot.shotIndex, {
            status: "running",
          });
          await persistStoryboardProgress(deps.repository, jobId, progress);

          try {
            const generated = await deps.videoService.generateVideo({
              prompt: buildShotPrompt({
                storyboard,
                shot,
                voiceStyle: input.data.voiceStyle,
                durationSec: shot.durationSec ?? requestedDuration,
              }),
              aspectRatio: input.data.aspectRatio,
              imageUrls: referenceImageUrls,
              imageInputs: seedanceImageInputs,
              durationSec: shot.durationSec ?? requestedDuration,
            });

            if (generated.status !== "succeeded" || !generated.videoUrl) {
              progress = updateStoryboardProgress(progress, shot.shotIndex, {
                status: "failed",
                externalJobId: generated.externalJobId,
                errorMessage: "shot generation did not return a successful video url",
              });
              await persistStoryboardProgress(deps.repository, jobId, progress);
              return {
                shotIndex: shot.shotIndex,
                status: "failed" as const,
                externalJobId: generated.externalJobId,
                errorMessage: "shot generation did not return a successful video url",
              };
            }

            progress = updateStoryboardProgress(progress, shot.shotIndex, {
              status: "succeeded",
              externalJobId: generated.externalJobId,
              videoUrl: generated.videoUrl,
            });
            await persistStoryboardProgress(deps.repository, jobId, progress);

            return {
              shotIndex: shot.shotIndex,
              status: "succeeded" as const,
              externalJobId: generated.externalJobId,
              videoUrl: generated.videoUrl,
            };
          } catch (error) {
            const message = toErrorMessage(error);
            const timeoutExternalJobId = extractTimedOutExternalJobId(message);

            if (timeoutExternalJobId) {
              progress = updateStoryboardProgress(progress, shot.shotIndex, {
                status: "running",
                externalJobId: timeoutExternalJobId,
                errorMessage: message,
              });
              await persistStoryboardProgress(deps.repository, jobId, progress);
              return {
                shotIndex: shot.shotIndex,
                status: "running" as const,
                externalJobId: timeoutExternalJobId,
                errorMessage: message,
              };
            }

            progress = updateStoryboardProgress(progress, shot.shotIndex, {
              status: "failed",
              errorMessage: message,
            });
            await persistStoryboardProgress(deps.repository, jobId, progress);
            return {
              shotIndex: shot.shotIndex,
              status: "failed" as const,
              errorMessage: message,
            };
          }
        }),
      );

      const failedShot = shotResults.find((item) => item.status === "failed");
      if (failedShot) {
        const externalJobId = collectExternalIds(progress).join(",");
        await deps.repository.setExternalJob(jobId, {
          provider: input.data.provider,
          externalJobId: externalJobId || failedShot.externalJobId || `storyboard:${jobId}`,
          externalStatus: encodeStoryboardProgress(progress),
        });
        await deps.repository.markFailed(
          jobId,
          failedShot.errorMessage ?? `shot ${failedShot.shotIndex} failed`,
        );
        return;
      }

      const stillRunning = shotResults.some((item) => item.status === "running");
      if (stillRunning) {
        const externalJobId = collectExternalIds(progress).join(",");
        await deps.repository.setExternalJob(jobId, {
          provider: input.data.provider,
          externalJobId: externalJobId || `storyboard:${jobId}`,
          externalStatus: encodeStoryboardProgress(progress),
        });
        await deps.repository.markRunning(jobId);
        return;
      }

      const orderedShotVideos = progress.shots
        .slice()
        .sort((a, b) => a.shotIndex - b.shotIndex)
        .map((shot) => shot.videoUrl ?? "")
        .filter((url) => url.length > 0);

      if (orderedShotVideos.length === 0) {
        throw new Error("storyboard generation produced no shot video outputs");
      }

      const merged = await mergeRemoteVideos({
        outputRoot: process.env.LOCAL_STORAGE_ROOT ?? "storage",
        jobId,
        videoUrls: orderedShotVideos,
      });
      const externalJobId = collectExternalIds(progress).join(",") || `storyboard:${jobId}`;

      await deps.repository.createVideoFromExternalJob({
        jobId,
        projectId: input.data.projectId,
        externalJobId,
        videoUrl: merged.url,
      });
      await deps.repository.setExternalJob(jobId, {
        provider: input.data.provider,
        externalJobId,
        externalStatus: encodeStoryboardProgress(progress),
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
