import { describe, expect, it, vi } from "vitest";

import { createAssetService, createPrismaAssetRepository } from "./asset.service";

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
        url: "/api/files/assets/abc.png",
        storageKey: "assets/abc.png",
        fileName: "hero.png",
        createdAt: "2026-03-12T00:00:00.000Z",
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
    expect(repository.createAsset).toHaveBeenCalledWith({
      projectId: "proj_1",
      fileName: "hero.png",
      storageKey: "assets/abc.png",
      url: "/api/files/assets/abc.png",
    });
    expect(result.url).toBe("/api/files/assets/abc.png");
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

  it("returns createdAt from prisma repository create result", async () => {
    const createdAt = new Date("2026-03-12T00:00:00.000Z");
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({ deletedAt: null }),
      },
      asset: {
        create: vi.fn().mockResolvedValue({
          id: "asset_1",
          projectId: "proj_1",
          fileName: "hero.png",
          storageKey: "assets/abc.png",
          url: "/api/files/assets/abc.png",
          createdAt,
        }),
      },
    };

    const repository = createPrismaAssetRepository(prisma as never);
    const result = await repository.createAsset({
      projectId: "proj_1",
      fileName: "hero.png",
      storageKey: "assets/abc.png",
      url: "/api/files/assets/abc.png",
    });

    expect(result).toMatchObject({
      id: "asset_1",
      projectId: "proj_1",
      fileName: "hero.png",
      storageKey: "assets/abc.png",
      url: "/api/files/assets/abc.png",
      createdAt: createdAt.toISOString(),
    });
  });

  it("soft-deletes asset by id and projectId", async () => {
    const repository = {
      createAsset: vi.fn(),
      softDeleteAsset: vi.fn().mockResolvedValue(true),
    };
    const service = createAssetService({
      storage: {
        saveBuffer: vi.fn(),
      },
      repository,
    });

    const deleted = await service.deleteImageAsset({
      assetId: "asset_1",
      projectId: "proj_1",
    });

    expect(repository.softDeleteAsset).toHaveBeenCalledOnce();
    expect(repository.softDeleteAsset).toHaveBeenCalledWith({
      assetId: "asset_1",
      projectId: "proj_1",
    });
    expect(deleted).toBe(true);
  });
});
