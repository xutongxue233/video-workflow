import { describe, expect, it } from "vitest";

import {
  getDefaultBaseUrlByProtocol,
  isProtocolSupportedForCapability,
} from "./model-provider.types";

describe("model provider types", () => {
  it("maps supported protocol by capability", () => {
    expect(isProtocolSupportedForCapability("text", "openai")).toBe(true);
    expect(isProtocolSupportedForCapability("text", "gemini")).toBe(true);
    expect(isProtocolSupportedForCapability("image", "seedream")).toBe(true);
    expect(isProtocolSupportedForCapability("image", "openai")).toBe(true);
    expect(isProtocolSupportedForCapability("video", "seedance")).toBe(true);
    expect(isProtocolSupportedForCapability("video", "google")).toBe(true);

    expect(isProtocolSupportedForCapability("text", "google")).toBe(false);
    expect(isProtocolSupportedForCapability("image", "gemini")).toBe(false);
    expect(isProtocolSupportedForCapability("image", "seedance")).toBe(false);
    expect(isProtocolSupportedForCapability("video", "openai")).toBe(false);
  });

  it("returns default base url for protocol", () => {
    expect(getDefaultBaseUrlByProtocol("openai")).toBe("https://api.openai.com/v1");
    expect(getDefaultBaseUrlByProtocol("seedream")).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(getDefaultBaseUrlByProtocol("gemini")).toBe(
      "https://generativelanguage.googleapis.com/v1beta",
    );
    expect(getDefaultBaseUrlByProtocol("seedance")).toBe("https://api.example.com/v1");
    expect(getDefaultBaseUrlByProtocol("google")).toBe(
      "https://generativelanguage.googleapis.com/v1beta",
    );
  });
});

