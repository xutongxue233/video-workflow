import { beforeEach, describe, expect, it, vi } from "vitest";

const { appConfigFindUnique, appConfigUpsert } = vi.hoisted(() => ({
  appConfigFindUnique: vi.fn(),
  appConfigUpsert: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appConfig: {
      findUnique: appConfigFindUnique,
      upsert: appConfigUpsert,
    },
  },
}));

import { GET, POST } from "./route";

describe("/api/model-settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default payload when no settings in database", async () => {
    appConfigFindUnique.mockResolvedValue(null);

    const response = await GET();
    const json = (await response.json()) as {
      providers: unknown[];
      modelsByProvider: Record<string, unknown>;
      source: string;
    };

    expect(response.status).toBe(200);
    expect(json).toEqual({
      providers: [],
      modelsByProvider: {},
      source: "default",
    });
  });

  it("saves sanitized settings into database", async () => {
    appConfigUpsert.mockResolvedValue({
      updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/model-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: [
            {
              id: "provider_1",
              name: "Text OpenAI",
              capability: "text",
              protocol: "openai",
              baseURL: "https://api.openai.com/v1",
              apiKey: "sk-xxx",
              enabled: true,
              selectedModelId: "gpt-4.1-mini",
              manualModelId: "",
            },
            {
              id: "bad",
              name: "bad",
              capability: "video",
              protocol: "openai",
              baseURL: "https://example.com",
              apiKey: "",
              enabled: true,
              selectedModelId: "",
              manualModelId: "",
            },
          ],
          modelsByProvider: {
            provider_1: [
              { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
              { id: "", label: "invalid" },
            ],
          },
        }),
      }),
    );

    const json = (await response.json()) as {
      providers: Array<{ id: string }>;
      modelsByProvider: Record<string, Array<{ id: string; label: string }>>;
    };

    expect(response.status).toBe(200);
    expect(appConfigUpsert).toHaveBeenCalledTimes(1);
    expect(json.providers.map((item) => item.id)).toEqual(["provider_1"]);
    expect(json.modelsByProvider).toEqual({
      provider_1: [{ id: "gpt-4.1-mini", label: "gpt-4.1-mini" }],
    });
  });
});
