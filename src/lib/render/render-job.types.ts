export const SUPPORTED_ASPECT_RATIOS = ["9:16", "16:9"] as const;

export type AspectRatio = (typeof SUPPORTED_ASPECT_RATIOS)[number];
export type VideoModelProtocol = "seedance" | "google";

export type RuntimeVideoModelConfig = {
  protocol: VideoModelProtocol;
  baseURL: string;
  apiKey: string;
  modelId: string;
};

export type RenderPayloadInput = {
  projectId: string;
  templateId: string;
  scriptId: string;
  voiceStyle: string;
  aspectRatio: AspectRatio;
  provider?: string;
  selectedVideoModel?: RuntimeVideoModelConfig;
};

export type RenderPayload = Omit<RenderPayloadInput, "provider"> & {
  provider: string;
};
