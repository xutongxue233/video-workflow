import { describe, expect, it } from "vitest";

import {
  parseStoredModelProviders,
  resolveProviderModelId,
  toRuntimeTextModelConfig,
  toRuntimeVideoModelConfig,
  type StoredModelProvider,
} from "./model-settings.local";

describe("model-settings local helpers", () => {
  const baseProvider: StoredModelProvider = {
    id: "provider_1",
    name: "Text OpenAI",
    capability: "text",
    protocol: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-xxx",
    enabled: true,
    selectedModelId: "gpt-4.1-mini",
    manualModelId: "",
  };

  it("parses only valid providers and drops invalid capability/protocol pair", () => {
    const parsed = parseStoredModelProviders([
      baseProvider,
      {
        ...baseProvider,
        id: "invalid_1",
        capability: "video",
        protocol: "openai",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("provider_1");
  });

  it("resolves selected model id with manual fallback", () => {
    expect(resolveProviderModelId(baseProvider)).toBe("gpt-4.1-mini");
    expect(
      resolveProviderModelId({
        ...baseProvider,
        selectedModelId: "",
        manualModelId: "custom-model",
      }),
    ).toBe("custom-model");
  });

  it("builds runtime text model config for enabled text provider", () => {
    const config = toRuntimeTextModelConfig(baseProvider);

    expect(config).toEqual({
      protocol: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-xxx",
      modelId: "gpt-4.1-mini",
    });
  });

  it("returns null runtime text config for disabled provider", () => {
    const config = toRuntimeTextModelConfig({
      ...baseProvider,
      enabled: false,
    });

    expect(config).toBeNull();
  });

  it("builds runtime video model config for enabled video provider", () => {
    const config = toRuntimeVideoModelConfig({
      id: "video_1",
      name: "Google Video",
      capability: "video",
      protocol: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "google-key",
      enabled: true,
      selectedModelId: "",
      manualModelId: "models/veo-3.0-generate-preview",
    });

    expect(config).toEqual({
      protocol: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "google-key",
      modelId: "models/veo-3.0-generate-preview",
    });
  });
});

