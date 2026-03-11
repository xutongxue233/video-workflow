import { describe, expect, it, vi } from "vitest";

import { createRenderJobProcessor } from "./render-worker";

function makeRecord(id: string) {
  return {
    id,
    projectId: "proj_1",
    templateId: "tpl_1",
    scriptId: "scr_1",
    voiceStyle: "energetic",
    aspectRatio: "9:16",
    provider: "seadance",
    externalJobId: null,
    externalStatus: null,
    attemptCount: 0,
    status: "QUEUED",
    idempotencyKey: `idem_${id}`,
    errorMessage: null,
    videoUrl: null,
  };
}

describe("render worker processor", () => {
  it("marks job succeeded and stores external video", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeRecord("job_1")),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn(),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn().mockResolvedValue(undefined),
      setExternalStatus: vi.fn().mockResolvedValue(undefined),
      getScriptStructuredJson: vi
        .fn()
        .mockResolvedValue('{"hook":"Print faster","shots":[{"index":1,"durationSec":5,"visual":"show model","caption":"detail","camera":"orbit"}]}'),
      createVideoFromExternalJob: vi.fn().mockResolvedValue(undefined),
    };

    const videoService = {
      generateVideo: vi.fn().mockResolvedValue({
        externalJobId: "ext_123",
        status: "succeeded",
        videoUrl: "https://cdn.example.com/video.mp4",
      }),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await processor({
      id: "job_1",
      data: {
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
      },
    });

    expect(repository.markRunning).toHaveBeenCalledWith("job_1");
    expect(videoService.generateVideo).toHaveBeenCalledOnce();
    expect(repository.setExternalJob).toHaveBeenCalledWith("job_1", {
      provider: "seadance",
      externalJobId: "ext_123",
      externalStatus: "succeeded",
    });
    expect(repository.createVideoFromExternalJob).toHaveBeenCalledOnce();
    expect(repository.markSucceeded).toHaveBeenCalledWith("job_1");
  });

  it("marks job failed when video generation throws", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeRecord("job_2")),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(undefined),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn(),
      setExternalStatus: vi.fn(),
      getScriptStructuredJson: vi.fn().mockResolvedValue('{"hook":"x","shots":[]}'),
      createVideoFromExternalJob: vi.fn(),
    };

    const videoService = {
      generateVideo: vi.fn().mockRejectedValue(new Error("provider error")),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await expect(
      processor({
        id: "job_2",
        data: {
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seadance",
        },
      }),
    ).rejects.toThrow("provider error");

    expect(repository.markFailed).toHaveBeenCalledWith("job_2", "provider error");
  });

  it("resolves queued job id via idempotency key when queue id differs from db id", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByIdempotencyKey: vi.fn().mockResolvedValue(makeRecord("job_db_1")),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn(),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn().mockResolvedValue(undefined),
      setExternalStatus: vi.fn().mockResolvedValue(undefined),
      getScriptStructuredJson: vi.fn().mockResolvedValue('{"hook":"x","shots":[]}'),
      createVideoFromExternalJob: vi.fn().mockResolvedValue(undefined),
    };

    const videoService = {
      generateVideo: vi.fn().mockResolvedValue({
        externalJobId: "ext_789",
        status: "succeeded",
        videoUrl: "https://cdn.example.com/video.mp4",
      }),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await processor({
      id: "idem_hash_123",
      data: {
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
      },
    });

    expect(repository.findById).toHaveBeenCalledWith("idem_hash_123");
    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith("idem_hash_123");
    expect(repository.incrementAttemptCount).toHaveBeenCalledWith("job_db_1");
    expect(repository.markRunning).toHaveBeenCalledWith("job_db_1");
    expect(repository.setExternalJob).toHaveBeenCalledWith("job_db_1", {
      provider: "seadance",
      externalJobId: "ext_789",
      externalStatus: "succeeded",
    });
    expect(repository.createVideoFromExternalJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job_db_1" }),
    );
    expect(repository.markSucceeded).toHaveBeenCalledWith("job_db_1");
  });
});
