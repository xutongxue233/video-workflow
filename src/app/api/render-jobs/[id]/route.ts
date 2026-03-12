import { NextResponse } from "next/server";

import { mergeRemoteVideos } from "../../../../lib/media/video-merge";
import { prisma } from "../../../../lib/db/prisma";
import type { RenderJobRecord, RenderJobRepository } from "../../../../lib/render/render-job.service";
import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";
import { encodeStoryboardProgress, parseStoryboardProgress } from "../../../../lib/render/storyboard-progress";
import { createGoogleCompatibleVideoClient } from "../../../../lib/video/google-video.service";
import { createOpenAICompatibleSeaDanceClient } from "../../../../lib/video/seadance-video.service";

function normalizeProvider(provider: string | null | undefined): string {
  return (provider ?? "").trim().toLowerCase();
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "storyboard merge recovery failed";
}

function getStoryboardMergeRecoveryInput(job: RenderJobRecord): {
  progressRaw: string;
  videoUrls: string[];
  externalJobId: string;
} | null {
  if (job.videoUrl) {
    return null;
  }

  const progress = parseStoryboardProgress(job.externalStatus);
  if (!progress) {
    return null;
  }

  if (progress.total <= 0 || progress.completed !== progress.total || progress.failed !== 0) {
    return null;
  }

  const orderedShots = progress.shots.slice().sort((a, b) => a.shotIndex - b.shotIndex);
  const videoUrls = orderedShots.map((shot) => shot.videoUrl ?? "").filter((url) => url.length > 0);
  if (videoUrls.length !== progress.total) {
    return null;
  }

  const externalJobId = orderedShots
    .map((shot) => shot.externalJobId ?? "")
    .filter((id) => id.length > 0)
    .join(",") || `storyboard:${job.id}`;

  return {
    progressRaw: encodeStoryboardProgress(progress),
    videoUrls,
    externalJobId,
  };
}

function shouldAttemptExternalSync(job: RenderJobRecord): boolean {
  if (parseStoryboardProgress(job.externalStatus)) {
    return false;
  }

  if (!job.externalJobId) {
    return false;
  }

  if (job.status === "RUNNING") {
    return true;
  }

  return job.status === "FAILED" && /timed out/i.test(job.errorMessage ?? "");
}

async function pollExternalJobStatus(job: RenderJobRecord): Promise<{
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  errorMessage?: string;
} | null> {
  const provider = normalizeProvider(job.provider);
  if (!job.externalJobId) {
    return null;
  }

  if (provider === "seadance" || provider === "seedance") {
    const baseURL = process.env.SEADANCE_BASE_URL;
    const apiKey = process.env.SEADANCE_API_KEY;
    if (!baseURL || !apiKey) {
      return null;
    }
    const client = createOpenAICompatibleSeaDanceClient({
      baseURL,
      apiKey,
    });
    return client.getVideoJob(job.externalJobId);
  }

  if (provider === "google") {
    const baseURL = process.env.GOOGLE_VIDEO_BASE_URL ?? process.env.GOOGLE_COMPAT_BASE_URL ?? "";
    const apiKey = process.env.GOOGLE_VIDEO_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
    if (!baseURL || !apiKey) {
      return null;
    }
    const client = createGoogleCompatibleVideoClient({
      baseURL,
      apiKey,
    });
    return client.getVideoJob(job.externalJobId);
  }

  return null;
}

async function reconcileJobByExternalStatus(
  repository: RenderJobRepository,
  job: RenderJobRecord,
): Promise<void> {
  if (!shouldAttemptExternalSync(job)) {
    return;
  }

  const external = await pollExternalJobStatus(job);
  if (!external) {
    return;
  }

  await repository.setExternalStatus(job.id, external.status);

  if (external.status === "succeeded" && external.videoUrl) {
    if (!job.videoUrl) {
      try {
        await repository.createVideoFromExternalJob({
          jobId: job.id,
          projectId: job.projectId,
          externalJobId: job.externalJobId ?? "",
          videoUrl: external.videoUrl,
        });
      } catch {
        // Ignore duplicate create if already persisted.
      }
    }
    await repository.markSucceeded(job.id);
    return;
  }

  if (external.status === "failed") {
    await repository.markFailed(
      job.id,
      external.errorMessage ?? job.errorMessage ?? "video generation failed",
    );
    return;
  }

  await repository.markRunning(job.id);
}

async function reconcileStoryboardMergedVideo(
  repository: RenderJobRepository,
  job: RenderJobRecord,
): Promise<void> {
  const recovery = getStoryboardMergeRecoveryInput(job);
  if (!recovery) {
    return;
  }

  try {
    const merged = await mergeRemoteVideos({
      outputRoot: process.env.LOCAL_STORAGE_ROOT ?? "storage",
      jobId: job.id,
      videoUrls: recovery.videoUrls,
    });

    if (!job.videoUrl) {
      try {
        await repository.createVideoFromExternalJob({
          jobId: job.id,
          projectId: job.projectId,
          externalJobId: recovery.externalJobId,
          videoUrl: merged.url,
        });
      } catch {
        // Ignore duplicate create if already persisted.
      }
    }

    await repository.setExternalJob(job.id, {
      provider: job.provider ?? "seadance",
      externalJobId: recovery.externalJobId,
      externalStatus: recovery.progressRaw,
    });
    await repository.markSucceeded(job.id);
  } catch (error) {
    await repository.markFailed(job.id, toMessage(error));
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repository = createPrismaRenderJobRepository(prisma);
  const job = await repository.findById(id);

  if (!job) {
    return NextResponse.json({ message: "Render job not found" }, { status: 404 });
  }

  await reconcileJobByExternalStatus(repository, job);
  const afterExternalSync = await repository.findById(id) ?? job;
  await reconcileStoryboardMergedVideo(repository, afterExternalSync);
  const latest = await repository.findById(id);
  const resolved = latest ?? afterExternalSync;
  const progress = parseStoryboardProgress(resolved.externalStatus);

  return NextResponse.json(
    {
      ...resolved,
      progress: progress
        ? {
            completed: progress.completed,
            total: progress.total,
            failed: progress.failed,
          }
        : null,
      shotStatuses: progress?.shots ?? [],
    },
    { status: 200 },
  );
}
