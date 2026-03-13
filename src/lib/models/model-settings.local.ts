import { z } from "zod";

import {
  getDefaultBaseUrlByProtocol,
  isProtocolSupportedForCapability,
  modelCapabilitySchema,
  modelProtocolSchema,
} from "./model-provider.types";

export const MODEL_SETTINGS_STORAGE_KEY = "video-workflow-model-providers-v1";
export const MODEL_SETTINGS_SESSION_STORAGE_KEY = "video-workflow-model-providers-session-v1";
export const MODEL_LIST_CACHE_SESSION_STORAGE_KEY = "video-workflow-model-list-cache-session-v1";

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

export type StoredListedModel = {
  id: string;
  label: string;
};

export type StoredModelListCache = Record<string, StoredListedModel[]>;

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

  const raw =
    window.sessionStorage.getItem(MODEL_SETTINGS_SESSION_STORAGE_KEY)
    ?? window.localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
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
  window.sessionStorage.setItem(MODEL_SETTINGS_SESSION_STORAGE_KEY, JSON.stringify(validated));
  window.localStorage.removeItem(MODEL_SETTINGS_STORAGE_KEY);
}

export function clearStoredModelProvidersFromBrowserStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(MODEL_SETTINGS_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(MODEL_SETTINGS_STORAGE_KEY);
  window.sessionStorage.removeItem(MODEL_LIST_CACHE_SESSION_STORAGE_KEY);
}

export function parseStoredModelListCache(raw: unknown): StoredModelListCache {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const output: StoredModelListCache = {};
  for (const [providerId, value] of Object.entries(record)) {
    if (!providerId.trim() || !Array.isArray(value)) {
      continue;
    }

    const parsed = value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const model = item as Record<string, unknown>;
        const id = typeof model.id === "string" ? model.id.trim() : "";
        const label = typeof model.label === "string" ? model.label.trim() : "";
        if (!id || !label) {
          return null;
        }
        return { id, label };
      })
      .filter((item): item is StoredListedModel => Boolean(item));

    if (parsed.length > 0) {
      output[providerId] = parsed;
    }
  }

  return output;
}

export function loadStoredModelListCacheFromBrowserStorage(): StoredModelListCache {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.sessionStorage.getItem(MODEL_LIST_CACHE_SESSION_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return parseStoredModelListCache(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveStoredModelListCacheToBrowserStorage(input: StoredModelListCache): void {
  if (typeof window === "undefined") {
    return;
  }

  const validated = parseStoredModelListCache(input);
  if (Object.keys(validated).length === 0) {
    window.sessionStorage.removeItem(MODEL_LIST_CACHE_SESSION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(MODEL_LIST_CACHE_SESSION_STORAGE_KEY, JSON.stringify(validated));
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
