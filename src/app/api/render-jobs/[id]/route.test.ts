import { afterEach, describe, expect, it, vi } from "vitest";

const { renderJobFindFirst } = vi.hoisted(() => ({
  renderJobFindFirst: vi.fn(),
}));

vi.mock("../../../../lib/render/render-job.repository", () => ({
  createPrismaRenderJobRepository: vi.fn(),
}));

vi.mock("../../../../lib/media/video-merge", () => ({
  mergeRemoteVideos: vi.fn(),
}));

vi.mock("../../../../lib/db/prisma", () => ({
  prisma: {
    renderJob: {
      findFirst: renderJobFindFirst,
    },
  },
}));

import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";
import { mergeRemoteVideos } from "../../../../lib/media/video-merge";

async function loadRoute() {
  return import("./route");
}

describe("/api/render-jobs/[id] route fallback merge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-merges storyboard video when all shots succeeded but final video is missing", async () => {
    renderJobFindFirst.mockResolvedValue({ id: "job_1" });

    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        id: "job_1",
        projectId: "proj_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seedance",
        externalJobId: null,
        status: "RUNNING",
        idempotencyKey: "idem_job_1",
        errorMessage: null,
        videoUrl: null,
        externalStatus: JSON.stringify({
          mode: "storyboard_v1",
          total: 2,
          completed: 2,
          failed: 0,
          shots: [
            {
              shotIndex: 1,
              status: "succeeded",
              externalJobId: "ext_1",
              videoUrl: "https://cdn.example.com/shot-1.mp4",
            },
            {
              shotIndex: 2,
              status: "succeeded",
              externalJobId: "ext_2",
              videoUrl: "https://cdn.example.com/shot-2.mp4",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        id: "job_1",
        projectId: "proj_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seedance",
        externalJobId: null,
        status: "RUNNING",
        idempotencyKey: "idem_job_1",
        errorMessage: null,
        videoUrl: null,
        externalStatus: JSON.stringify({
          mode: "storyboard_v1",
          total: 2,
          completed: 2,
          failed: 0,
          shots: [
            {
              shotIndex: 1,
              status: "succeeded",
              externalJobId: "ext_1",
              videoUrl: "https://cdn.example.com/shot-1.mp4",
            },
            {
              shotIndex: 2,
              status: "succeeded",
              externalJobId: "ext_2",
              videoUrl: "https://cdn.example.com/shot-2.mp4",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        id: "job_1",
        projectId: "proj_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seedance",
        externalJobId: "ext_1,ext_2",
        status: "SUCCEEDED",
        idempotencyKey: "idem_job_1",
        errorMessage: null,
        videoUrl: "/api/files/videos/merged/job_1.mp4",
        externalStatus: JSON.stringify({
          mode: "storyboard_v1",
          total: 2,
          completed: 2,
          failed: 0,
          shots: [
            {
              shotIndex: 1,
              status: "succeeded",
              externalJobId: "ext_1",
              videoUrl: "https://cdn.example.com/shot-1.mp4",
            },
            {
              shotIndex: 2,
              status: "succeeded",
              externalJobId: "ext_2",
              videoUrl: "https://cdn.example.com/shot-2.mp4",
            },
          ],
        }),
      });
    const createVideoFromExternalJob = vi.fn().mockResolvedValue(undefined);
    const setExternalJob = vi.fn().mockResolvedValue(undefined);
    const markSucceeded = vi.fn().mockResolvedValue(undefined);

    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById,
      createVideoFromExternalJob,
      setExternalJob,
      markSucceeded,
      setExternalStatus: vi.fn(),
      markFailed: vi.fn(),
    } as never);

    vi.mocked(mergeRemoteVideos).mockResolvedValue({
      storageKey: "videos/merged/job_1.mp4",
      url: "/api/files/videos/merged/job_1.mp4",
      absolutePath: "D:/tmp/job_1.mp4",
    });

    const { GET } = await loadRoute();
    const response = await GET(
      new Request("http://localhost/api/render-jobs/job_1"),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    const json = (await response.json()) as { videoUrl?: string; status?: string };

    expect(response.status).toBe(200);
    expect(json.status).toBe("SUCCEEDED");
    expect(json.videoUrl).toBe("/api/files/videos/merged/job_1.mp4");
    expect(mergeRemoteVideos).toHaveBeenCalledOnce();
    expect(createVideoFromExternalJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_1",
        videoUrl: "/api/files/videos/merged/job_1.mp4",
      }),
    );
    expect(markSucceeded).toHaveBeenCalledWith("job_1");
  });
});
