import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveProjectAssetsByIds, toAssetImageDataUrl } = vi.hoisted(() => ({
  resolveProjectAssetsByIds: vi.fn(),
  toAssetImageDataUrl: vi.fn(),
}));

vi.mock("../../../../../lib/assets/reference-asset.service", () => ({
  resolveProjectAssetsByIds,
  toAssetImageDataUrl,
}));

import { POST } from "./route";

describe("/api/ai/scripts/autofill route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses multimodal image input from reference asset IDs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
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
    resolveProjectAssetsByIds.mockResolvedValue([
      {
        id: "asset_1",
        projectId: "proj_1",
        fileName: "dragon-final-v3.png",
        storageKey: "assets/asset-1.png",
        url: "/api/files/assets/asset-1.png",
      },
    ]);
    toAssetImageDataUrl.mockResolvedValue("data:image/png;base64,AAAA");

    const request = new Request("http://localhost/api/ai/scripts/autofill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        contentLanguage: "zh-CN",
        referenceAssetIds: ["asset_1"],
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

    const modelRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
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
    expect(resolveProjectAssetsByIds).toHaveBeenCalledWith({
      prisma: expect.any(Object),
      projectId: "proj_1",
      assetIds: ["asset_1"],
    });
    expect(toAssetImageDataUrl).toHaveBeenCalledOnce();
  });

  it("returns 422 when reference asset resolution fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    resolveProjectAssetsByIds.mockRejectedValue(new Error("reference assets not found in project: asset_1"));

    const request = new Request("http://localhost/api/ai/scripts/autofill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: "proj_1",
        contentLanguage: "zh-CN",
        referenceAssetIds: ["asset_1"],
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
    expect(json.message).toContain("reference assets not found");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
