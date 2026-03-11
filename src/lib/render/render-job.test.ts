import { describe, expect, it } from "vitest";

import {
  buildRenderJobIdempotencyKey,
  buildRenderPayload,
} from "./render-job";

describe("render-job domain", () => {
  it("builds normalized render payload from user input", () => {
    const payload = buildRenderPayload({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
    });

    expect(payload).toEqual({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      provider: "seadance",
    });
  });

  it("generates deterministic idempotency key for same payload", () => {
    const input = {
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16" as const,
    };

    expect(buildRenderJobIdempotencyKey(input)).toBe(
      buildRenderJobIdempotencyKey(input),
    );
  });

  it("rejects unsupported aspect ratio", () => {
    expect(() =>
      buildRenderPayload({
        projectId: "proj_1",
        templateId: "tpl_a",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "1:1",
      }),
    ).toThrow("aspectRatio");
  });

  it("changes idempotency key when provider differs", () => {
    const base = {
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16" as const,
    };

    const keyA = buildRenderJobIdempotencyKey({
      ...base,
      provider: "seadance",
    });
    const keyB = buildRenderJobIdempotencyKey({
      ...base,
      provider: "custom-provider",
    });

    expect(keyA).not.toBe(keyB);
  });

  it("uses selected video model protocol as provider when provider is omitted", () => {
    const payload = buildRenderPayload({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      selectedVideoModel: {
        protocol: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "local-key",
        modelId: "models/veo-3.0-generate-preview",
      },
    });

    expect(payload.provider).toBe("google");
  });

  it("does not include video model api key in idempotency key fingerprint", () => {
    const baseInput = {
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16" as const,
      selectedVideoModel: {
        protocol: "seedance" as const,
        baseURL: "https://api.example.com/v1",
        apiKey: "secret-key-a",
        modelId: "seadance-v1",
      },
    };

    const keyA = buildRenderJobIdempotencyKey(baseInput);
    const keyB = buildRenderJobIdempotencyKey({
      ...baseInput,
      selectedVideoModel: {
        ...baseInput.selectedVideoModel,
        apiKey: "secret-key-b",
      },
    });

    expect(keyA).toBe(keyB);
  });
});
