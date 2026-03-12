import { z } from "zod";

import {
  getDefaultBaseUrlByProtocol,
  isProtocolSupportedForCapability,
  modelCapabilitySchema,
  modelProtocolSchema,
} from "./model-provider.types";

export const MODEL_SETTINGS_STORAGE_KEY = "video-workflow-model-providers-v1";

const storedModelProviderSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    capability: modelCapabilitySchema,
    protocol: modelProtocolSchema,
    baseURL: z.string().min(1),
    apiKey: z.string().default(""),
    enabled: z.boolean(),
    selectedModelId: z.string().default(""),
    manualModelId: z.string().default(""),
  })
  .refine(
    (input) => isProtocolSupportedForCapability(input.capability, input.protocol),
    "protocol does not match capability",
  );

export type StoredModelProvider = z.infer<typeof storedModelProviderSchema>;

export type RuntimeTextModelConfig = {
  protocol: "openai" | "gemini";
  baseURL: string;
  apiKey: string;
  modelId: string;
};

export type RuntimeVideoModelConfig = {
  protocol: "seedance" | "google";
  baseURL: string;
  apiKey: string;
  modelId: string;
};

export type RuntimeImageModelConfig = {
  protocol: "seedream" | "openai";
  baseURL: string;
  apiKey: string;
  modelId: string;
};

export function parseStoredModelProviders(raw: unknown): StoredModelProvider[] {
  const array = Array.isArray(raw) ? raw : [];

  return array
    .map((item) => storedModelProviderSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);
}

export function loadStoredModelProvidersFromLocalStorage(): StoredModelProvider[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return parseStoredModelProviders(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getSsrSafeInitialModelProviders(): StoredModelProvider[] {
  return [];
}

export function saveStoredModelProvidersToLocalStorage(input: StoredModelProvider[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const validated = parseStoredModelProviders(input);
  window.localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(validated));
}

export function resolveProviderModelId(input: {
  selectedModelId: string;
  manualModelId: string;
}): string {
  return input.selectedModelId.trim() || input.manualModelId.trim();
}

export function toRuntimeTextModelConfig(
  provider: StoredModelProvider,
): RuntimeTextModelConfig | null {
  if (!provider.enabled || provider.capability !== "text") {
    return null;
  }

  if (provider.protocol !== "openai" && provider.protocol !== "gemini") {
    return null;
  }

  const modelId = resolveProviderModelId(provider);
  if (!modelId || !provider.apiKey.trim() || !provider.baseURL.trim()) {
    return null;
  }

  return {
    protocol: provider.protocol,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    modelId,
  };
}

export function toRuntimeVideoModelConfig(
  provider: StoredModelProvider,
): RuntimeVideoModelConfig | null {
  if (!provider.enabled || provider.capability !== "video") {
    return null;
  }

  if (provider.protocol !== "seedance" && provider.protocol !== "google") {
    return null;
  }

  const modelId = resolveProviderModelId(provider);
  if (!modelId || !provider.apiKey.trim() || !provider.baseURL.trim()) {
    return null;
  }

  return {
    protocol: provider.protocol,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    modelId,
  };
}

export function toRuntimeImageModelConfig(
  provider: StoredModelProvider,
): RuntimeImageModelConfig | null {
  if (!provider.enabled || provider.capability !== "image") {
    return null;
  }

  if (provider.protocol !== "openai" && provider.protocol !== "seedream") {
    return null;
  }

  const modelId = resolveProviderModelId(provider);
  if (!modelId || !provider.apiKey.trim() || !provider.baseURL.trim()) {
    return null;
  }

  return {
    protocol: provider.protocol,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    modelId,
  };
}

export function createDefaultStoredModelProvider(input: {
  id: string;
  capability: StoredModelProvider["capability"];
  protocol: StoredModelProvider["protocol"];
}): StoredModelProvider {
  return {
    id: input.id,
    name: `${input.capability}-${input.protocol}`,
    capability: input.capability,
    protocol: input.protocol,
    baseURL: getDefaultBaseUrlByProtocol(input.protocol),
    apiKey: "",
    enabled: false,
    selectedModelId: "",
    manualModelId: "",
  };
}
