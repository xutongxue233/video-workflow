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
      referenceImageUrls: [],
      referenceAssets: [],
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
        aspectRatio: "1:1" as never,
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

  it("accepts durationSec -1 for model auto duration", () => {
    const payload = buildRenderPayload({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      durationSec: -1,
    });

    expect(payload.durationSec).toBe(-1);
  });

  it("accepts durationSec 30 and defers provider-specific normalization", () => {
    const payload = buildRenderPayload({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      durationSec: 30,
    });

    expect(payload.durationSec).toBe(30);
  });

  it("rejects lastFrameUrl without firstFrameUrl", () => {
    expect(() =>
      buildRenderPayload({
        projectId: "proj_1",
        templateId: "tpl_a",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        lastFrameUrl: "https://img.example.com/last.png",
      }),
    ).toThrow("firstFrameUrl");
  });

  it("rejects mixing frame mode and reference image mode", () => {
    expect(() =>
      buildRenderPayload({
        projectId: "proj_1",
        templateId: "tpl_a",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        firstFrameUrl: "https://img.example.com/first.png",
        referenceImageUrls: ["https://img.example.com/reference.png"],
      }),
    ).toThrow("referenceImageUrls");
  });

  it("rejects reference assets from another project", () => {
    expect(() =>
      buildRenderPayload({
        projectId: "proj_1",
        templateId: "tpl_a",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        referenceAssets: [
          {
            id: "asset_1",
            projectId: "proj_2",
            fileName: "x.png",
            url: "https://img.example.com/x.png",
          },
        ],
      }),
    ).toThrow("referenceAssets");
  });

  it("accepts up to 24 reference assets", () => {
    const payload = buildRenderPayload({
      projectId: "proj_1",
      templateId: "tpl_a",
      scriptId: "scr_1",
      voiceStyle: "energetic",
      aspectRatio: "9:16",
      referenceAssets: Array.from({ length: 24 }, (_, index) => ({
        id: `asset_${index + 1}`,
        projectId: "proj_1",
        fileName: `ref-${index + 1}.png`,
        url: `https://img.example.com/ref-${index + 1}.png`,
      })),
    });

    expect(payload.referenceAssets).toHaveLength(24);
    expect(payload.referenceImageUrls).toHaveLength(24);
  });

  it("rejects more than 24 reference assets", () => {
    expect(() =>
      buildRenderPayload({
        projectId: "proj_1",
        templateId: "tpl_a",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        referenceAssets: Array.from({ length: 25 }, (_, index) => ({
          id: `asset_${index + 1}`,
          projectId: "proj_1",
          fileName: `ref-${index + 1}.png`,
          url: `https://img.example.com/ref-${index + 1}.png`,
        })),
      }),
    ).toThrow("referenceAssets");
  });
});
