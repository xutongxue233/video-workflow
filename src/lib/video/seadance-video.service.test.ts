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

  it("uses duration -1 by default for Seedance 1.5 pro", async () => {
    const client = {
      createVideoJob: vi.fn().mockResolvedValue({
        externalJobId: "ext_1",
        status: "succeeded",
      }),
      getVideoJob: vi.fn(),
    };

    const service = createSeaDanceVideoService({
      client,
      model: "doubao-seedance-1-5-pro-251215",
      pollIntervalMs: 1,
      pollTimeoutMs: 500,
    });

    await service.generateVideo({
      prompt: "auto duration",
      aspectRatio: "9:16",
      imageUrls: [],
    });

    expect(client.createVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSec: -1,
      }),
    );
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
      durationSec: 30,
      watermark: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      content: Array<{ type: string; text?: string; role?: string; image_url?: { url: string } }>;
      ratio: string;
      duration: number;
      watermark: boolean;
    };

    expect(requestBody.model).toBe("doubao-seedance-1-0-pro-250528");
    expect(requestBody.ratio).toBe("16:9");
    expect(requestBody.duration).toBe(30);
    expect(requestBody.watermark).toBe(false);
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

  it("uses reference_image role for image guidance payload", async () => {
    const imageBytes = Uint8Array.from([7, 8, 9]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(imageBytes.buffer),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "cgt_456",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeaDanceClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "test-key",
    });

    await client.createVideoJob({
      model: "doubao-seedance-1-0-lite-i2v",
      prompt: "keep exact product geometry",
      aspectRatio: "9:16",
      imageUrls: ["https://img.example.com/reference.png"],
      durationSec: 8,
      watermark: false,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      content: Array<{ type: string; role?: string }>;
    };

    expect(requestBody.content).toContainEqual(
      expect.objectContaining({
        type: "image_url",
        role: "reference_image",
      }),
    );
  });

  it("supports first_frame and last_frame role payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "cgt_789",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeaDanceClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "test-key",
    });

    await client.createVideoJob({
      model: "doubao-seedance-1-5-pro-251215",
      prompt: "use first and last frame",
      aspectRatio: "16:9",
      imageUrls: [],
      imageInputs: [
        {
          url: "data:image/png;base64,Zmlyc3Q=",
          role: "first_frame",
        },
        {
          url: "data:image/png;base64,bGFzdA==",
          role: "last_frame",
        },
      ],
      durationSec: -1,
      watermark: false,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      content: Array<{ type: string; role?: string; image_url?: { url: string } }>;
    };

    expect(requestBody.content).toContainEqual(
      expect.objectContaining({
        type: "image_url",
        role: "first_frame",
        image_url: expect.objectContaining({
          url: "data:image/png;base64,Zmlyc3Q=",
        }),
      }),
    );
    expect(requestBody.content).toContainEqual(
      expect.objectContaining({
        type: "image_url",
        role: "last_frame",
        image_url: expect.objectContaining({
          url: "data:image/png;base64,bGFzdA==",
        }),
      }),
    );
  });

  it("encodes image urls to data url before sending task request", async () => {
    const imageBytes = Uint8Array.from([1, 2, 3, 4]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(imageBytes.buffer),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "cgt_900",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeaDanceClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "test-key",
    });

    await client.createVideoJob({
      model: "doubao-seedance-1-5-pro-251215",
      prompt: "base64 image",
      aspectRatio: "9:16",
      imageUrls: ["https://assets.example.com/frame.png"],
      durationSec: 6,
      watermark: false,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      content: Array<{ type: string; image_url?: { url: string } }>;
    };
    const imagePayload = requestBody.content.find((item) => item.type === "image_url");

    expect(imagePayload?.image_url?.url).toMatch(/^data:image\/png;base64,/);
  });
});
