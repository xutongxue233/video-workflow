import { describe, expect, it } from "vitest";

import {
  PROJECT_CONFIG_KEY,
  loadProjectScopedConfig,
  saveProjectScopedConfig,
  trySaveProjectScopedConfig,
  type ProjectScopedConfig,
} from "./project-scoped-config";

function createMemoryStorage(initial?: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

const SAMPLE_CONFIG: ProjectScopedConfig = {
  generationPayload: {
    productName: "Dragon V2",
    sellingPointsText: "high detail, strong support",
    targetAudience: "tabletop gamers",
    tone: "energetic",
    durationSec: 30,
  },
  contentLanguage: "zh-CN",
  voiceStyle: "energetic",
  renderAspectRatio: "9:16",
  selectedTextProviderId: "txt_1",
  selectedVideoProviderId: "vid_1",
  selectedReferenceAssetIds: ["asset_1"],
};

describe("project scoped config", () => {
  it("saves and loads config by project id", () => {
    const storage = createMemoryStorage();

    saveProjectScopedConfig(storage, "proj_1", SAMPLE_CONFIG);
    const loaded = loadProjectScopedConfig(storage, "proj_1");

    expect(loaded).toEqual(SAMPLE_CONFIG);
  });

  it("does not overwrite existing config when hydration is incomplete", () => {
    const storage = createMemoryStorage();

    saveProjectScopedConfig(storage, "proj_1", SAMPLE_CONFIG);

    const changed = trySaveProjectScopedConfig({
      storage,
      projectId: "proj_1",
      config: {
        ...SAMPLE_CONFIG,
        generationPayload: {
          ...SAMPLE_CONFIG.generationPayload,
          productName: "Default Product",
        },
      },
      hydrated: false,
    });

    expect(changed).toBe(false);
    const loaded = loadProjectScopedConfig(storage, "proj_1");
    expect(loaded?.generationPayload.productName).toBe("Dragon V2");
  });

  it("writes config after hydration is complete", () => {
    const storage = createMemoryStorage({
      [PROJECT_CONFIG_KEY]: JSON.stringify({
        proj_1: SAMPLE_CONFIG,
      }),
    });

    const changed = trySaveProjectScopedConfig({
      storage,
      projectId: "proj_1",
      config: {
        ...SAMPLE_CONFIG,
        generationPayload: {
          ...SAMPLE_CONFIG.generationPayload,
          productName: "New Product",
        },
      },
      hydrated: true,
    });

    expect(changed).toBe(true);
    const loaded = loadProjectScopedConfig(storage, "proj_1");
    expect(loaded?.generationPayload.productName).toBe("New Product");
  });
});

