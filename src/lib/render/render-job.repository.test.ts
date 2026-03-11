import { describe, expect, it, vi } from "vitest";

import { createPrismaRenderJobRepository } from "./render-job.repository";

function makeRecord(id: string) {
  return {
    id,
    projectId: "proj_1",
    templateId: "tpl_1",
    scriptId: "scr_1",
    voiceStyle: "energetic",
    aspectRatio: "9:16",
    provider: "seadance",
    externalJobId: "ext_1",
    externalStatus: "running",
    attemptCount: 1,
    status: "RUNNING",
    idempotencyKey: `idem_${id}`,
    errorMessage: null,
    video: {
      url: "https://cdn.example.com/out.mp4",
    },
  };
}

describe("render-job repository", () => {
  it("creates queued job and marks it as created", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null);
    const create = vi.fn().mockResolvedValue(makeRecord("job_1"));
    const repository = createPrismaRenderJobRepository({
      team: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      project: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      renderJob: {
        findUnique,
        create,
      },
    } as never);

    const created = await repository.createQueuedJob({
      projectId: "proj_1",
      templateId: "tpl_1",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      provider: "seadance",
      idempotencyKey: "idem_job_1",
    });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "idem_job_1" },
      }),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(created.created).toBe(true);
    expect(created.record.id).toBe("job_1");
  });

  it("returns existing job and skips create when idempotency key already exists", async () => {
    const existing = makeRecord("job_existing");
    existing.idempotencyKey = "idem_existing";
    const findUnique = vi.fn().mockResolvedValue(existing);
    const create = vi.fn();
    const repository = createPrismaRenderJobRepository({
      team: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      project: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      renderJob: {
        findUnique,
        create,
      },
    } as never);

    const created = await repository.createQueuedJob({
      projectId: "proj_1",
      templateId: "tpl_1",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      provider: "seadance",
      idempotencyKey: "idem_existing",
    });

    expect(create).not.toHaveBeenCalled();
    expect(created.created).toBe(false);
    expect(created.record.id).toBe("job_existing");
  });

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

  it("finds job by idempotency key when queue id is hashed", async () => {
    const repository = createPrismaRenderJobRepository({
      renderJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: "job_cuid_1",
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seadance",
          externalJobId: "ext_1",
          externalStatus: "running",
          attemptCount: 1,
          status: "RUNNING",
          idempotencyKey: "hash_abc",
          errorMessage: null,
          video: {
            url: "https://cdn.example.com/out.mp4",
          },
        }),
      },
    } as never);

    const job = await repository.findByIdempotencyKey?.("hash_abc");

    expect(job?.id).toBe("job_cuid_1");
    expect(job?.idempotencyKey).toBe("hash_abc");
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
