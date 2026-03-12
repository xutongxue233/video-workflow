import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/media/video-merge", () => ({
  mergeRemoteVideos: vi.fn().mockResolvedValue({
    storageKey: "videos/merged/job_storyboard.mp4",
    url: "/api/files/videos/merged/job_storyboard.mp4",
    absolutePath: "D:/tmp/job_storyboard.mp4",
  }),
}));

import { mergeRemoteVideos } from "../lib/media/video-merge";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("keeps job running when provider times out and external id can be parsed", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeRecord("job_3")),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn().mockResolvedValue(undefined),
      setExternalStatus: vi.fn(),
      getScriptStructuredJson: vi.fn().mockResolvedValue('{"hook":"x","shots":[{"index":1,"durationSec":5,"visual":"v","caption":"c","camera":"cam"}]}'),
      createVideoFromExternalJob: vi.fn(),
    };

    const videoService = {
      generateVideo: vi.fn().mockRejectedValue(new Error("SeaDance job cgt-20260312151057-k2c4q timed out")),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await expect(
      processor({
        id: "job_3",
        data: {
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seedance",
        },
      }),
    ).resolves.toBeUndefined();

    expect(repository.setExternalJob).toHaveBeenCalledWith("job_3", {
      provider: "seedance",
      externalJobId: "cgt-20260312151057-k2c4q",
      externalStatus: "running",
    });
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.markSucceeded).not.toHaveBeenCalled();
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

  it("resolves retry queue job id back to render job id", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeRecord("job_retry_target")),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
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
        externalJobId: "ext_retry_1",
        status: "succeeded",
        videoUrl: "https://cdn.example.com/video-retry.mp4",
      }),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await processor({
      id: "retry:job_retry_target:1710000000000",
      data: {
        projectId: "proj_1",
        templateId: "tpl_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
      },
    });

    expect(repository.findById).toHaveBeenCalledWith("retry:job_retry_target:1710000000000");
    expect(repository.findById).toHaveBeenCalledWith("job_retry_target");
    expect(repository.markSucceeded).toHaveBeenCalledWith("job_retry_target");
  });

  it("merges storyboard shots and outputs final video when all shots succeed", async () => {
    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeRecord("job_storyboard")),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn(),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn().mockResolvedValue(undefined),
      setExternalStatus: vi.fn().mockResolvedValue(undefined),
      getScriptStructuredJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "Storefront Storyboard",
          hook: "Hook",
          cta: "CTA",
          shots: [
            {
              index: 1,
              durationSec: 4,
              visual: "Shot 1",
              caption: "Caption 1",
              camera: "push in",
            },
            {
              index: 2,
              durationSec: 4,
              visual: "Shot 2",
              caption: "Caption 2",
              camera: "orbit",
            },
          ],
        }),
      ),
      createVideoFromExternalJob: vi.fn().mockResolvedValue(undefined),
    };

    const videoService = {
      generateVideo: vi
        .fn()
        .mockResolvedValueOnce({
          externalJobId: "ext_shot_1",
          status: "succeeded",
          videoUrl: "https://cdn.example.com/shot-1.mp4",
        })
        .mockResolvedValueOnce({
          externalJobId: "ext_shot_2",
          status: "succeeded",
          videoUrl: "https://cdn.example.com/shot-2.mp4",
        }),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await expect(
      processor({
        id: "job_storyboard",
        data: {
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seadance",
        },
      }),
    ).resolves.toBeUndefined();

    expect(videoService.generateVideo).toHaveBeenCalledTimes(2);
    expect(mergeRemoteVideos).toHaveBeenCalledOnce();
    expect(repository.createVideoFromExternalJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_storyboard",
        videoUrl: "/api/files/videos/merged/job_storyboard.mp4",
      }),
    );
    expect(repository.markSucceeded).toHaveBeenCalledWith("job_storyboard");
  });

  it("retries only unfinished storyboard shots and skips succeeded ones", async () => {
    const existingProgress = JSON.stringify({
      mode: "storyboard_v1",
      total: 2,
      completed: 1,
      failed: 1,
      shots: [
        {
          shotIndex: 1,
          durationSec: 4,
          visual: "Shot 1",
          status: "succeeded",
          externalJobId: "ext_done_1",
          videoUrl: "https://cdn.example.com/done-1.mp4",
        },
        {
          shotIndex: 2,
          durationSec: 4,
          visual: "Shot 2",
          status: "failed",
          errorMessage: "old failure",
        },
      ],
    });

    const repository = {
      createQueuedJob: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        ...makeRecord("job_storyboard_retry"),
        status: "FAILED",
        externalStatus: existingProgress,
      }),
      markRunning: vi.fn().mockResolvedValue(undefined),
      markSucceeded: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn(),
      incrementAttemptCount: vi.fn().mockResolvedValue(undefined),
      setExternalJob: vi.fn().mockResolvedValue(undefined),
      setExternalStatus: vi.fn().mockResolvedValue(undefined),
      getScriptStructuredJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "Storefront Storyboard",
          hook: "Hook",
          cta: "CTA",
          shots: [
            {
              index: 1,
              durationSec: 4,
              visual: "Shot 1",
              caption: "Caption 1",
              camera: "push in",
            },
            {
              index: 2,
              durationSec: 4,
              visual: "Shot 2",
              caption: "Caption 2",
              camera: "orbit",
            },
          ],
        }),
      ),
      createVideoFromExternalJob: vi.fn().mockResolvedValue(undefined),
    };

    const videoService = {
      generateVideo: vi.fn().mockResolvedValue({
        externalJobId: "ext_retry_2",
        status: "succeeded",
        videoUrl: "https://cdn.example.com/retry-2.mp4",
      }),
    };

    const processor = createRenderJobProcessor({
      repository,
      videoService,
    });

    await expect(
      processor({
        id: "job_storyboard_retry",
        data: {
          projectId: "proj_1",
          templateId: "tpl_1",
          scriptId: "scr_1",
          voiceStyle: "energetic",
          aspectRatio: "9:16",
          provider: "seadance",
        },
      }),
    ).resolves.toBeUndefined();

    expect(videoService.generateVideo).toHaveBeenCalledTimes(1);
    expect(mergeRemoteVideos).toHaveBeenCalledOnce();
    expect(repository.createVideoFromExternalJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_storyboard_retry",
        videoUrl: "/api/files/videos/merged/job_storyboard.mp4",
      }),
    );
    expect(repository.markSucceeded).toHaveBeenCalledWith("job_storyboard_retry");
  });
});
