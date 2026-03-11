import { describe, expect, it, vi } from "vitest";

import {
  createOpenAICompatibleSeaDanceClient,
  createSeaDanceVideoService,
} from "./seadance-video.service";

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

describe("openai-compatible seadance client", () => {
  it("creates job with volc content list payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "cgt_123",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeaDanceClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "test-key",
    });

    const created = await client.createVideoJob({
      model: "doubao-seedance-1-0-pro-250528",
      prompt: "cinematic product shot",
      aspectRatio: "16:9",
      imageUrls: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      content: Array<{ type: string; text?: string }>;
      ratio: string;
    };

    expect(requestBody.model).toBe("doubao-seedance-1-0-pro-250528");
    expect(requestBody.ratio).toBe("16:9");
    expect(requestBody.content).toEqual([
      {
        type: "text",
        text: "cinematic product shot",
      },
    ]);
    expect(created).toEqual({
      externalJobId: "cgt_123",
      status: "queued",
    });
  });

  it("polls volc task api and returns content.video_url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "cgt_123",
        status: "succeeded",
        content: {
          video_url: "https://cdn.example.com/video.mp4",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeaDanceClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "test-key",
    });

    const polled = await client.getVideoJob("cgt_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/cgt_123",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(polled).toEqual({
      status: "succeeded",
      videoUrl: "https://cdn.example.com/video.mp4",
      errorMessage: undefined,
    });
  });
});
