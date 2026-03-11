import { describe, expect, it, vi } from "vitest";

import { createRenderJobService } from "./render-job.service";

function makeQueuedJob(id: string) {
  return {
    id,
    projectId: "proj_1",
    templateId: "tpl_a",
    scriptId: "scr_1",
    voiceStyle: "energetic",
    aspectRatio: "9:16",
    status: "QUEUED",
    idempotencyKey: `idem_${id}`,
  };
}

describe("render-job service", () => {
  it("creates queued job and enqueues render task", async () => {
    const repository = {
      createQueuedJob: vi.fn().mockResolvedValue({
        record: makeQueuedJob("job_1"),
        created: true,
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

  it("forwards selected runtime video model config to queue payload", async () => {
    const repository = {
      createQueuedJob: vi.fn().mockResolvedValue({
        record: {
          ...makeQueuedJob("job_2"),
          aspectRatio: "16:9",
        },
        created: true,
      }),
      findById: vi.fn(),
    };
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const service = createRenderJobService({ repository, queue });

    await service.create({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "16:9",
      selectedVideoModel: {
        protocol: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "local-key",
        modelId: "models/veo-3.0-generate-preview",
      },
    });

    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        selectedVideoModel: {
          protocol: "google",
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: "local-key",
          modelId: "models/veo-3.0-generate-preview",
        },
      }),
      expect.any(String),
    );
  });

  it("returns existing queued job without re-enqueuing when idempotent request is repeated", async () => {
    const repository = {
      createQueuedJob: vi.fn().mockResolvedValue({
        record: makeQueuedJob("job_existing"),
        created: false,
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
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(result.id).toBe("job_existing");
  });
});
