import { createHash } from "node:crypto";

import { z } from "zod";

import { type RenderPayload, type RenderPayloadInput, SUPPORTED_ASPECT_RATIOS } from "./render-job.types";

const selectedVideoModelSchema = z.object({
  protocol: z.enum(["seedance", "google"]),
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
});

const referenceAssetSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fileName: z.string().min(1).nullable().optional(),
  url: z.string().url(),
});

const renderPayloadSchema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  scriptId: z.string().min(1),
  voiceStyle: z.string().min(1),
  aspectRatio: z.enum(SUPPORTED_ASPECT_RATIOS),
  durationSec: z.number().int().min(-1).max(60).optional(),
  firstFrameUrl: z.string().url().optional(),
  lastFrameUrl: z.string().url().optional(),
  referenceImageUrls: z.array(z.string().url()).max(8).optional().default([]),
  referenceAssets: z.array(referenceAssetSchema).max(8).optional().default([]),
  requestNonce: z.string().optional(),
  provider: z.string().min(1).optional(),
  selectedVideoModel: selectedVideoModelSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.lastFrameUrl && !value.firstFrameUrl) {
    ctx.addIssue({
      path: ["firstFrameUrl"],
      code: z.ZodIssueCode.custom,
      message: "firstFrameUrl is required when lastFrameUrl is provided",
    });
  }

  const hasReferenceMode = value.referenceImageUrls.length > 0 || value.referenceAssets.length > 0;
  if (hasReferenceMode && (typeof value.firstFrameUrl === "string" || typeof value.lastFrameUrl === "string")) {
    ctx.addIssue({
      path: ["referenceImageUrls"],
      code: z.ZodIssueCode.custom,
      message: "referenceImageUrls cannot be combined with firstFrameUrl/lastFrameUrl",
    });
  }

  value.referenceAssets.forEach((asset, index) => {
    if (asset.projectId !== value.projectId) {
      ctx.addIssue({
        path: ["referenceAssets", index, "projectId"],
        code: z.ZodIssueCode.custom,
        message: "referenceAssets must belong to the same projectId",
      });
    }
  });
});

export function buildRenderPayload(input: RenderPayloadInput): RenderPayload {
  const parsed = renderPayloadSchema.parse(input);
  const normalizedReferenceImageUrls =
    parsed.referenceImageUrls.length > 0 ? parsed.referenceImageUrls : parsed.referenceAssets.map((asset) => asset.url);

  return {
    ...parsed,
    referenceImageUrls: normalizedReferenceImageUrls,
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
    String(payload.durationSec),
    payload.provider,
    payload.firstFrameUrl ?? "",
    payload.lastFrameUrl ?? "",
    payload.referenceImageUrls?.join(",") ?? "",
    payload.referenceAssets?.map((asset) => [asset.id, asset.projectId, asset.url].join("|")).join(",") ?? "",
    payload.requestNonce ?? "",
    selectedVideoModelFingerprint,
  ].join(":");

  return createHash("sha256").update(fingerprint).digest("hex");
}
