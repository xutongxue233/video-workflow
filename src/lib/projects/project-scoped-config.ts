export type Locale = "zh-CN" | "en-US";

export type ProjectScopedConfig = {
  generationPayload: {
    productName: string;
    sellingPointsText: string;
    targetAudience: string;
    tone: string;
    durationSec: number;
  };
  contentLanguage: Locale;
  voiceStyle: string;
  renderAspectRatio: "9:16" | "16:9";
  selectedTextProviderId: string;
  selectedImageProviderId: string;
  selectedVideoProviderId: string;
  selectedReferenceAssetIds: string[];
};

export const PROJECT_CONFIG_KEY = "video-workflow-project-config-v1";

export function loadProjectScopedConfig(storage: Storage, projectId: string): ProjectScopedConfig | null {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return null;
  }

  const raw = storage.getItem(PROJECT_CONFIG_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[normalizedProjectId];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const config = value as Partial<ProjectScopedConfig>;
    if (!config.generationPayload) {
      return null;
    }

    return {
      generationPayload: {
        productName: config.generationPayload.productName ?? "",
        sellingPointsText: config.generationPayload.sellingPointsText ?? "",
        targetAudience: config.generationPayload.targetAudience ?? "",
        tone: config.generationPayload.tone ?? "",
        durationSec: Number(config.generationPayload.durationSec ?? 30),
      },
      contentLanguage: config.contentLanguage === "en-US" ? "en-US" : "zh-CN",
      voiceStyle: config.voiceStyle ?? "energetic",
      renderAspectRatio: config.renderAspectRatio === "16:9" ? "16:9" : "9:16",
      selectedTextProviderId: config.selectedTextProviderId ?? "",
      selectedImageProviderId: config.selectedImageProviderId ?? "",
      selectedVideoProviderId: config.selectedVideoProviderId ?? "",
      selectedReferenceAssetIds: Array.isArray(config.selectedReferenceAssetIds)
        ? config.selectedReferenceAssetIds.filter((item) => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export function saveProjectScopedConfig(storage: Storage, projectId: string, config: ProjectScopedConfig): void {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return;
  }

  let current: Record<string, unknown> = {};

  try {
    const raw = storage.getItem(PROJECT_CONFIG_KEY);
    current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    current = {};
  }

  current[normalizedProjectId] = config;
  storage.setItem(PROJECT_CONFIG_KEY, JSON.stringify(current));
}

export function trySaveProjectScopedConfig(input: {
  storage: Storage;
  projectId: string;
  config: ProjectScopedConfig;
  hydrated: boolean;
}): boolean {
  if (!input.hydrated) {
    return false;
  }

  if (!input.projectId.trim()) {
    return false;
  }

  saveProjectScopedConfig(input.storage, input.projectId, input.config);
  return true;
}

