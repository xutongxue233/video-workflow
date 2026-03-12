import { describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleSeedreamClient } from "./seedream-image.service";

describe("seedream image service", () => {
  it("sends image generation request and returns decoded images", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            { b64_json: Buffer.from("img-a").toString("base64") },
            { b64_json: Buffer.from("img-b").toString("base64") },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "seedream-key",
    });

    const result = await client.generateImages({
      model: "doubao-seedream-5.0-lite",
      prompt: "coffee store poster",
      inputImageDataUrls: ["data:image/png;base64,AAAA"],
      outputCount: 2,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.model).toBe("doubao-seedream-5.0-lite");
    expect(payload.sequential_image_generation).toBe("auto");
    expect(payload.sequential_image_generation_options?.max_images).toBe(2);
    expect(result).toHaveLength(2);
    expect(result[0]?.content.toString("utf8")).toBe("img-a");
  });

  it("throws readable error when provider returns failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: "bad request" } }),
      }),
    );

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "seedream-key",
    });

    await expect(
      client.generateImages({
        model: "doubao-seedream-5.0-lite",
        prompt: "x",
        inputImageDataUrls: ["data:image/png;base64,AAAA"],
        outputCount: 1,
      }),
    ).rejects.toThrow("seedream image generation failed: 400 bad request");
  });

  it("normalizes api key value before setting Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ b64_json: Buffer.from("img-a").toString("base64") }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "SEEDREAM_API_KEY=Bearer seedream-key",
    });

    await client.generateImages({
      model: "doubao-seedream-5.0-lite",
      prompt: "coffee store poster",
      inputImageDataUrls: ["data:image/png;base64,AAAA"],
      outputCount: 1,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer seedream-key",
    });
  });

  it("rejects env-placeholder api key before sending request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "$ARK_API_KEY",
    });

    await expect(
      client.generateImages({
        model: "doubao-seedream-5.0-lite",
        prompt: "coffee store poster",
        inputImageDataUrls: ["data:image/png;base64,AAAA"],
        outputCount: 1,
      }),
    ).rejects.toThrow("seedream api key placeholder detected");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects url-like api key before sending request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = createOpenAICompatibleSeedreamClient({
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "https://ark.cn-beijing.volces.com/api/v3/",
    });

    await expect(
      client.generateImages({
        model: "doubao-seedream-5.0-lite",
        prompt: "coffee store poster",
        inputImageDataUrls: ["data:image/png;base64,AAAA"],
        outputCount: 1,
      }),
    ).rejects.toThrow("seedream api key looks like an endpoint url");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
