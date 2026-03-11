import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchProviderModelList } from "./model-list.service";

describe("model-list service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches models via openai-compatible protocol", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-4.1-mini" },
          { id: "gpt-4o" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProviderModelList({
      protocol: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: "test-key",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-key",
      },
    });
    expect(result).toEqual([
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-4o", label: "gpt-4o" },
    ]);
  });

  it("fetches models via gemini-compatible protocol", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
          { name: "models/gemini-2.5-pro" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProviderModelList({
      protocol: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models?key=test-key",
      {
        method: "GET",
      },
    );
    expect(result).toEqual([
      { id: "models/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "models/gemini-2.5-pro", label: "models/gemini-2.5-pro" },
    ]);
  });

  it("throws provider error when response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProviderModelList({
        protocol: "seedance",
        baseURL: "https://api.example.com/v1",
        apiKey: "bad-key",
      }),
    ).rejects.toThrow("model list failed: 401 Unauthorized");
  });
});

