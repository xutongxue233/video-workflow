import { afterEach, describe, expect, it, vi } from "vitest";

const { renderJobFindFirst } = vi.hoisted(() => ({
  renderJobFindFirst: vi.fn(),
}));

vi.mock("../../../../lib/render/render-job.repository", () => ({
  createPrismaRenderJobRepository: vi.fn(),
}));

vi.mock("../../../../lib/db/prisma", () => ({
  prisma: {
    renderJob: {
      findFirst: renderJobFindFirst,
    },
  },
}));

import { createPrismaRenderJobRepository } from "../../../../lib/render/render-job.repository";

async function loadRoute() {
  return import("./route");
}

describe("/api/render-jobs/[id] route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns read-only render job payload without side effects", async () => {
    renderJobFindFirst.mockResolvedValue({ id: "job_1" });
    const findById = vi.fn().mockResolvedValue({
      id: "job_1",
      projectId: "proj_1",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      provider: "seedance",
      externalJobId: "ext_1",
      status: "RUNNING",
      idempotencyKey: "idem_job_1",
      errorMessage: null,
      videoUrl: null,
      externalStatus: JSON.stringify({
        mode: "storyboard_v1",
        total: 2,
        completed: 1,
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
            status: "running",
            externalJobId: "ext_2",
          },
        ],
      }),
    });
    const markRunning = vi.fn();
    const markSucceeded = vi.fn();
    const markFailed = vi.fn();
    const createVideoFromExternalJob = vi.fn();

    vi.mocked(createPrismaRenderJobRepository).mockReturnValue({
      findById,
      markRunning,
      markSucceeded,
      markFailed,
      createVideoFromExternalJob,
    } as never);

    const { GET } = await loadRoute();
    const response = await GET(
      new Request("http://localhost/api/render-jobs/job_1"),
      { params: Promise.resolve({ id: "job_1" }) },
    );
    const json = (await response.json()) as {
      status?: string;
      progress?: { completed: number; total: number; failed: number } | null;
      shotStatuses?: Array<{ shotIndex: number; status: string }>;
    };

    expect(response.status).toBe(200);
    expect(json.status).toBe("RUNNING");
    expect(json.progress).toEqual({
      completed: 1,
      total: 2,
      failed: 0,
    });
    expect(Array.isArray(json.shotStatuses)).toBe(true);
    expect(markRunning).not.toHaveBeenCalled();
    expect(markSucceeded).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(createVideoFromExternalJob).not.toHaveBeenCalled();
  });
});
