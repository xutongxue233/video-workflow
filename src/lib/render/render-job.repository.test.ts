import { describe, expect, it, vi } from "vitest";

import { createPrismaRenderJobRepository } from "./render-job.repository";

describe("render-job repository", () => {
  it("returns videoUrl from related video record when fetching job", async () => {
    const repository = createPrismaRenderJobRepository({
      renderJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: "job_1",
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seadance",
          externalJobId: "ext_1",
          externalStatus: "succeeded",
          attemptCount: 1,
          status: "SUCCEEDED",
          idempotencyKey: "idem_1",
          errorMessage: null,
          video: {
            url: "https://cdn.example.com/out.mp4",
          },
        }),
      },
    } as never);

    const job = await repository.findById("job_1");

    expect(job?.videoUrl).toBe("https://cdn.example.com/out.mp4");
  });

  it("returns null when job does not exist", async () => {
    const repository = createPrismaRenderJobRepository({
      renderJob: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never);

    const job = await repository.findById("missing");

    expect(job).toBeNull();
  });
});

