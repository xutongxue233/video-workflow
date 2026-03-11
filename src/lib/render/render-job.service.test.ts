import { describe, expect, it, vi } from "vitest";

import { createRenderJobService } from "./render-job.service";

describe("render-job service", () => {
  it("creates queued job and enqueues render task", async () => {
    const repository = {
      createQueuedJob: vi.fn().mockResolvedValue({
        id: "job_1",
        projectId: "proj_1",
        templateId: "tpl_a",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        status: "QUEUED",
        idempotencyKey: "idem_1",
      }),
      findById: vi.fn(),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const service = createRenderJobService({ repository, queue });

    const result = await service.create({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
    });

    expect(repository.createQueuedJob).toHaveBeenCalledOnce();
    expect(queue.enqueue).toHaveBeenCalledOnce();
    expect(result.id).toBe("job_1");
    expect(result.status).toBe("QUEUED");
  });

  it("returns null when job id does not exist", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    };
    const queue = {
      enqueue: vi.fn(),
    };

    const service = createRenderJobService({ repository, queue });

    const result = await service.getById("missing");

    expect(result).toBeNull();
  });
});
