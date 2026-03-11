import { describe, expect, it, vi } from "vitest";

import { createSeaDanceVideoService } from "./seadance-video.service";

describe("seadance video service", () => {
  it("creates and polls external job until success", async () => {
    const client = {
      createVideoJob: vi.fn().mockResolvedValue({
        externalJobId: "ext_1",
        status: "queued",
      }),
      getVideoJob: vi
        .fn()
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({
          status: "succeeded",
          videoUrl: "https://cdn.example.com/video.mp4",
        }),
    };

    const service = createSeaDanceVideoService({
      client,
      model: "seadance-v1",
      pollIntervalMs: 1,
      pollTimeoutMs: 500,
    });

    const result = await service.generateVideo({
      prompt: "A cinematic reveal of a 3D printed dragon",
      aspectRatio: "9:16",
      imageUrls: ["https://img.example.com/dragon.png"],
    });

    expect(client.createVideoJob).toHaveBeenCalledOnce();
    expect(client.getVideoJob).toHaveBeenCalledTimes(2);
    expect(result.externalJobId).toBe("ext_1");
    expect(result.status).toBe("succeeded");
    expect(result.videoUrl).toBe("https://cdn.example.com/video.mp4");
  });

  it("throws when provider returns failed status", async () => {
    const service = createSeaDanceVideoService({
      client: {
        createVideoJob: vi.fn().mockResolvedValue({
          externalJobId: "ext_1",
          status: "queued",
        }),
        getVideoJob: vi.fn().mockResolvedValue({
          status: "failed",
          errorMessage: "invalid input",
        }),
      },
      model: "seadance-v1",
      pollIntervalMs: 1,
      pollTimeoutMs: 500,
    });

    await expect(
      service.generateVideo({
        prompt: "invalid",
        aspectRatio: "9:16",
        imageUrls: [],
      }),
    ).rejects.toThrow("invalid input");
  });

  it("throws on timeout", async () => {
    const service = createSeaDanceVideoService({
      client: {
        createVideoJob: vi.fn().mockResolvedValue({
          externalJobId: "ext_1",
          status: "queued",
        }),
        getVideoJob: vi.fn().mockResolvedValue({ status: "running" }),
      },
      model: "seadance-v1",
      pollIntervalMs: 5,
      pollTimeoutMs: 10,
    });

    await expect(
      service.generateVideo({
        prompt: "still running",
        aspectRatio: "9:16",
        imageUrls: [],
      }),
    ).rejects.toThrow("timed out");
  });
});
