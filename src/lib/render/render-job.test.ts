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
});
