import {
  parseStoredModelListCache,
  parseStoredModelProviders,
  type StoredModelListCache,
  type StoredModelProvider,
} from "./model-settings.local";

export const MODEL_SETTINGS_DB_KEY = "model-settings-v1";

export type PersistedModelSettings = {
  providers: StoredModelProvider[];
  modelsByProvider: StoredModelListCache;
};

export function parsePersistedModelSettings(raw: unknown): PersistedModelSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      providers: [],
      modelsByProvider: {},
    };
  }

  const record = raw as Record<string, unknown>;
  const providers = parseStoredModelProviders(record.providers);
  const modelsByProvider = parseStoredModelListCache(record.modelsByProvider);

  return {
    providers,
    modelsByProvider,
  };
}
