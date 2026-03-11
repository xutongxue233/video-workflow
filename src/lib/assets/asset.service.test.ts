import { describe, expect, it, vi } from "vitest";

import { createAssetService } from "./asset.service";

describe("asset service", () => {
  it("stores file and creates asset record", async () => {
    const storage = {
      saveBuffer: vi.fn().mockResolvedValue({
        storageKey: "assets/abc.png",
        absolutePath: "D:/storage/assets/abc.png",
      }),
    };

    const repository = {
      createAsset: vi.fn().mockResolvedValue({
        id: "asset_1",
        projectId: "proj_1",
        url: "/files/assets/abc.png",
        storageKey: "assets/abc.png",
        fileName: "hero.png",
      }),
    };

    const service = createAssetService({ storage, repository });

    const result = await service.uploadImageAsset({
      projectId: "proj_1",
      fileName: "hero.png",
      content: Buffer.from("image-data"),
    });

    expect(storage.saveBuffer).toHaveBeenCalledOnce();
    expect(repository.createAsset).toHaveBeenCalledOnce();
    expect(result.url).toBe("/files/assets/abc.png");
  });

  it("rejects empty file content", async () => {
    const service = createAssetService({
      storage: {
        saveBuffer: vi.fn(),
      },
      repository: {
        createAsset: vi.fn(),
      },
    });

    await expect(
      service.uploadImageAsset({
        projectId: "proj_1",
        fileName: "hero.png",
        content: Buffer.alloc(0),
      }),
    ).rejects.toThrow("empty");
  });
});
