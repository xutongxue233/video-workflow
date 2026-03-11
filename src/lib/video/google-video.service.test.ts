import { describe, expect, it, vi } from "vitest";

import { createGoogleVideoService } from "./google-video.service";

describe("google video service", () => {
  it("creates and polls operation until success", async () => {
    const client = {
      createVideoJob: vi.fn().mockResolvedValue({
        externalJobId: "operations/video_123",
        status: "queued",
      }),
      getVideoJob: vi
        .fn()
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({
          status: "succeeded",
          videoUrl: "https://storage.googleapis.com/video.mp4",
        }),
    };

    const service = createGoogleVideoService({
      client,
      model: "models/veo-3.0-generate-preview",
      pollIntervalMs: 1,
      pollTimeoutMs: 200,
    });

    const result = await service.generateVideo({
      prompt: "Generate a cinematic reveal",
      aspectRatio: "16:9",
      imageUrls: [],
    });

    expect(client.createVideoJob).toHaveBeenCalledOnce();
    expect(client.getVideoJob).toHaveBeenCalledTimes(2);
    expect(result.externalJobId).toBe("operations/video_123");
    expect(result.status).toBe("succeeded");
    expect(result.videoUrl).toBe("https://storage.googleapis.com/video.mp4");
  });

  it("throws when google operation returns failed status", async () => {
    const service = createGoogleVideoService({
      client: {
        createVideoJob: vi.fn().mockResolvedValue({
          externalJobId: "operations/video_123",
          status: "queued",
        }),
        getVideoJob: vi.fn().mockResolvedValue({
          status: "failed",
          errorMessage: "invalid prompt",
        }),
      },
      model: "models/veo-3.0-generate-preview",
      pollIntervalMs: 1,
      pollTimeoutMs: 200,
    });

    await expect(
      service.generateVideo({
        prompt: "invalid",
        aspectRatio: "16:9",
        imageUrls: [],
      }),
    ).rejects.toThrow("invalid prompt");
  });
});

