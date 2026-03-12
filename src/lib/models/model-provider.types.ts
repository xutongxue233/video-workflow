import { z } from "zod";

export const MODEL_CAPABILITIES = ["text", "image", "video"] as const;
export const MODEL_PROTOCOLS = ["openai", "gemini", "seedance", "seedream", "google"] as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export type ModelProtocol = (typeof MODEL_PROTOCOLS)[number];

export const modelCapabilitySchema = z.enum(MODEL_CAPABILITIES);
export const modelProtocolSchema = z.enum(MODEL_PROTOCOLS);

const protocolByCapability: Record<ModelCapability, ModelProtocol[]> = {
  text: ["openai", "gemini"],
  image: ["seedream", "openai"],
  video: ["seedance", "google"],
};

const defaultBaseUrlByProtocol: Record<ModelProtocol, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  seedance: "https://api.example.com/v1",
  seedream: "https://ark.cn-beijing.volces.com/api/v3",
  google: "https://generativelanguage.googleapis.com/v1beta",
};

export function isProtocolSupportedForCapability(
  capability: ModelCapability,
  protocol: ModelProtocol,
): boolean {
  return protocolByCapability[capability].includes(protocol);
}

export function getProtocolsForCapability(capability: ModelCapability): ModelProtocol[] {
  return [...protocolByCapability[capability]];
}

export function getDefaultBaseUrlByProtocol(protocol: ModelProtocol): string {
  return defaultBaseUrlByProtocol[protocol];
}

