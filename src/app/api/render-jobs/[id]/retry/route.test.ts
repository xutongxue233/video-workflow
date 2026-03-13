import { afterEach, describe, expect, it, vi } from "vitest";

const { renderJobFindFirst } = vi.hoisted(() => ({
  renderJobFindFirst: vi.fn(),
}));
const { resolveProjectAssetsByIds } = vi.hoisted(() => ({
  resolveProjectAssetsByIds: vi.fn(),
}));

vi.mock("../../../../../lib/render/render-job.repository", () => ({
  createPrismaRenderJobRepository: vi.fn(),
}));
vi.mock("../../../../../lib/assets/reference-asset.service", () => ({
  resolveProjectAssetsByIds,
  toAbsoluteAssetUrl: vi.fn((url: string) => `http://localhost${url}`),
}));

vi.mock("../../../../../lib/queue/render-queue", () => ({
  getRenderQueue: vi.fn(),
  buildRenderQueueJobOptions: vi.fn(),
}));

vi.mock("../../../../../lib/db/prisma", () => ({
  prisma: {
    renderJob: {
      findFirst: renderJobFindFirst,
    },
  },
}));

import { buildRenderQueueJobOptions, getRenderQueue } from "../../../../../lib/queue/render-queue";
import { createPrismaRenderJobRepository } from "../../../../../lib/render/render-job.repository";

async function loadRoute() {
  return import("./route");
}

describe("/api/render-jobs/[id]/retry route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resolveProjectAssetsByIds.mockReset();
  });

  it("returns 404 when render job is missing", async () => {
    renderJobFindFirst.mockResolvedValue({ id: "missing" });
    resolveProjectAssetsByIds.mockResolvedValue([]);

    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(null),
      markRunning: vi.fn(),
    } as never);
    vi.mocked(getRenderQueue).mockReturnValue({
      add: vi.fn(),
    } as never);
    vi.mocked(buildRenderQueueJobOptions).mockReturnValue({ jobId: "retry:missing:1710000000000" });

    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/render-jobs/missing/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns existing result when video already exists and skips enqueue", async () => {
    const add = vi.fn();
    renderJobFindFirst.mockResolvedValue({ id: "job_done" });
    resolveProjectAssetsByIds.mockResolvedValue([]);

    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({
        id: "job_done",
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
        status: "SUCCEEDED",
        idempotencyKey: "idem_job_done",
        videoUrl: "/api/files/videos/merged/job_done.mp4",
      }),
      markRunning: vi.fn(),
    } as never);
    vi.mocked(getRenderQueue).mockReturnValue({
      add,
    } as never);
    vi.mocked(buildRenderQueueJobOptions).mockReturnValue({ jobId: "retry:job_done:1710000000000" });

    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/render-jobs/job_done/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "job_done" }) },
    );
    const json = (await response.json()) as { skipped?: boolean; videoUrl?: string };

    expect(response.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(json.videoUrl).toBe("/api/files/videos/merged/job_done.mp4");
    expect(add).not.toHaveBeenCalled();
  });

  it("enqueues retry with queue job id and returns accepted", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    renderJobFindFirst.mockResolvedValue({ id: "job_failed" });
    resolveProjectAssetsByIds.mockResolvedValue([
      {
        id: "asset_1",
        projectId: "proj_1",
        fileName: "a.png",
        storageKey: "assets/a.png",
        url: "/api/files/assets/a.png",
      },
    ]);

    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    const markRunning = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({
        id: "job_failed",
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
        status: "FAILED",
        idempotencyKey: "idem_job_failed",
        videoUrl: null,
      }),
      markRunning,
    } as never);
    vi.mocked(getRenderQueue).mockReturnValue({
      add,
    } as never);
    vi.mocked(buildRenderQueueJobOptions).mockReturnValue({
      jobId: "retry:job_failed:1710000000000",
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 3000,
    });

    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/render-jobs/job_failed/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSec: 30,
          referenceAssetIds: ["asset_1"],
        }),
      }),
      { params: Promise.resolve({ id: "job_failed" }) },
    );
    const json = (await response.json()) as { renderJobId?: string; status?: string };

    expect(response.status).toBe(202);
    expect(json.renderJobId).toBe("job_failed");
    expect(json.status).toBe("QUEUED");
    expect(buildRenderQueueJobOptions).toHaveBeenCalledWith("retry:job_failed:1710000000000");
    expect(resolveProjectAssetsByIds).toHaveBeenCalledWith({
      prisma: expect.any(Object),
      projectId: "proj_1",
      assetIds: ["asset_1"],
    });
    expect(add).toHaveBeenCalledWith(
      "render",
      expect.objectContaining({
        projectId: "proj_1",
        scriptId: "scr_1",
        templateId: "tpl_1",
        referenceAssets: [
          expect.objectContaining({
            id: "asset_1",
            projectId: "proj_1",
            url: "http://localhost/api/files/assets/a.png",
          }),
        ],
      }),
      expect.objectContaining({
        jobId: "retry:job_failed:1710000000000",
      }),
    );
    expect(markRunning).toHaveBeenCalledWith("job_failed");
  });

  it("allows retry for running storyboard-complete job without final video", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const markRunning = vi.fn().mockResolvedValue(undefined);
    renderJobFindFirst.mockResolvedValue({ id: "job_running_stuck" });
    resolveProjectAssetsByIds.mockResolvedValue([]);

    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({
        id: "job_running_stuck",
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
        status: "RUNNING",
        idempotencyKey: "idem_job_running_stuck",
        videoUrl: null,
        externalStatus: JSON.stringify({
          mode: "storyboard_v1",
          total: 1,
          completed: 1,
          failed: 0,
          shots: [
            { shotIndex: 1, status: "succeeded", videoUrl: "https://cdn.example.com/1.mp4" },
          ],
        }),
      }),
      markRunning,
    } as never);
    vi.mocked(getRenderQueue).mockReturnValue({
      add,
    } as never);
    vi.mocked(buildRenderQueueJobOptions).mockReturnValue({
      jobId: "retry:job_running_stuck:1710000000000",
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 3000,
    });

    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/render-jobs/job_running_stuck/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "job_running_stuck" }) },
    );
    const json = (await response.json()) as { renderJobId?: string; status?: string };

    expect(response.status).toBe(202);
    expect(json.renderJobId).toBe("job_running_stuck");
    expect(json.status).toBe("QUEUED");
    expect(add).toHaveBeenCalledOnce();
    expect(markRunning).toHaveBeenCalledWith("job_running_stuck");
  });
});
