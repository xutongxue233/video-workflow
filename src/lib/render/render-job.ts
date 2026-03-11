import { createHash } from "node:crypto";

import { z } from "zod";

import { type RenderPayload, type RenderPayloadInput, SUPPORTED_ASPECT_RATIOS } from "./render-job.types";

const renderPayloadSchema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  scriptId: z.string().min(1),
  voiceStyle: z.string().min(1),
  aspectRatio: z.enum(SUPPORTED_ASPECT_RATIOS),
  provider: z.string().min(1).default("seadance"),
});

export function buildRenderPayload(input: RenderPayloadInput): RenderPayload {
  return renderPayloadSchema.parse(input);
}

export function buildRenderJobIdempotencyKey(input: RenderPayloadInput): string {
  const payload = buildRenderPayload(input);
  const fingerprint = [
    payload.projectId,
    payload.templateId,
    payload.scriptId,
    payload.voiceStyle,
    payload.aspectRatio,
    payload.provider,
  ].join(":");

  return createHash("sha256").update(fingerprint).digest("hex");
}
