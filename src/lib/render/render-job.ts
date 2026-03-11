import { createHash } from "node:crypto";

import { z } from "zod";

import { type RenderPayload, type RenderPayloadInput, SUPPORTED_ASPECT_RATIOS } from "./render-job.types";

const selectedVideoModelSchema = z.object({
  protocol: z.enum(["seedance", "google"]),
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
});

const renderPayloadSchema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  scriptId: z.string().min(1),
  voiceStyle: z.string().min(1),
  aspectRatio: z.enum(SUPPORTED_ASPECT_RATIOS),
  provider: z.string().min(1).optional(),
  selectedVideoModel: selectedVideoModelSchema.optional(),
});

export function buildRenderPayload(input: RenderPayloadInput): RenderPayload {
  const parsed = renderPayloadSchema.parse(input);

  return {
    ...parsed,
    provider: parsed.provider ?? parsed.selectedVideoModel?.protocol ?? "seadance",
  };
}

export function buildRenderJobIdempotencyKey(input: RenderPayloadInput): string {
  const payload = buildRenderPayload(input);
  const selectedVideoModelFingerprint = payload.selectedVideoModel
    ? [payload.selectedVideoModel.protocol, payload.selectedVideoModel.baseURL, payload.selectedVideoModel.modelId].join(
        ":",
      )
    : "";
  const fingerprint = [
    payload.projectId,
    payload.templateId,
    payload.scriptId,
    payload.voiceStyle,
    payload.aspectRatio,
    payload.provider,
    selectedVideoModelFingerprint,
  ].join(":");

  return createHash("sha256").update(fingerprint).digest("hex");
}
