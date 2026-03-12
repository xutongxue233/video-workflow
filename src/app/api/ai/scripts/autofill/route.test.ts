import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("/api/ai/scripts/autofill route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses multimodal image input and does not rely on fileName text", async () => {
    const imageBytes = Uint8Array.from([1, 2, 3, 4]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null),
        },
        arrayBuffer: async () => imageBytes.buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: "Dragon Figurine",
                  targetAudience: "tabletop hobbyists",
                  sellingPoints: ["high detail", "clean silhouette", "stable base"],
                  tone: "energetic",
                  durationSec: 30,
                }),
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/ai/scripts/autofill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        contentLanguage: "zh-CN",
        referenceAssets: [
          {
            id: "asset_1",
            projectId: "proj_1",
            fileName: "dragon-final-v3.png",
            url: "https://assets.example.com/dragon.png",
          },
        ],
        modelProvider: {
          protocol: "openai",
          baseURL: "https://api.example.com/v1",
          apiKey: "sk-test",
          modelId: "gpt-4.1-mini",
        },
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as {
      productName?: string;
      sellingPoints?: string[];
    };

    expect(response.status).toBe(200);
    expect(json.productName).toBe("Dragon Figurine");
    expect(Array.isArray(json.sellingPoints)).toBe(true);

    const modelRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>;
    };
    const systemMessage = modelRequest.messages.find((item) => item.role === "system");
    const userMessage = modelRequest.messages.find((item) => item.role === "user");
    const userContent = Array.isArray(userMessage?.content) ? userMessage.content : [];
    const textPart = userContent.find((item) => item.type === "text");
    const imagePart = userContent.find((item) => item.type === "image_url");

    expect(imagePart).toBeTruthy();
    expect(textPart?.text).not.toContain("dragon-final-v3.png");
    expect(typeof systemMessage?.content === "string" ? systemMessage.content : "").toContain(
      "storefront",
    );
    expect(typeof systemMessage?.content === "string" ? systemMessage.content : "").toContain(
      "不用发传单也客流不断",
    );
  });

  it("returns 422 when no image url can be converted to image content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/ai/scripts/autofill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        contentLanguage: "zh-CN",
        referenceAssets: [
          {
            id: "asset_1",
            projectId: "proj_1",
            fileName: "dragon-final-v3.png",
            url: "https://assets.example.com/missing.png",
          },
        ],
        modelProvider: {
          protocol: "openai",
          baseURL: "https://api.example.com/v1",
          apiKey: "sk-test",
          modelId: "gpt-4.1-mini",
        },
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { message?: string };

    expect(response.status).toBe(422);
    expect(json.message).toContain("No accessible image content found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
