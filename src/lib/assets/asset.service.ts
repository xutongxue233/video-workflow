import { AssetType, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../db/prisma";
import { ensureWorkflowProjectExists } from "../projects/workflow-project";

import type { LocalStorage } from "../storage/local-storage";

type CreateAssetRecordInput = {
  projectId: string;
  fileName: string;
  storageKey: string;
  url: string;
};

type AssetRecord = {
  id: string;
  projectId: string;
  fileName: string | null;
  storageKey: string;
  url: string;
  createdAt: string;
};

type AssetRepository = {
  createAsset(input: CreateAssetRecordInput): Promise<AssetRecord>;
  softDeleteAsset(input: { assetId: string; projectId?: string }): Promise<boolean>;
};

type AssetService = {
  uploadImageAsset(input: {
    projectId: string;
    fileName: string;
    content: Buffer;
  }): Promise<AssetRecord>;
  deleteImageAsset(input: {
    assetId: string;
    projectId?: string;
  }): Promise<boolean>;
};

export function createAssetService(deps: {
  storage: Pick<LocalStorage, "saveBuffer">;
  repository: AssetRepository;
}): AssetService {
  return {
    async uploadImageAsset(input) {
      if (!input.content.byteLength) {
        throw new Error("empty file content is not allowed");
      }

      const stored = await deps.storage.saveBuffer({
        scope: "assets",
        fileName: input.fileName,
        content: input.content,
      });

      return deps.repository.createAsset({
        projectId: input.projectId,
        fileName: input.fileName,
        storageKey: stored.storageKey,
        url: `/api/files/${stored.storageKey}`,
      });
    },

    async deleteImageAsset(input) {
      if (!input.assetId.trim()) {
        throw new Error("assetId is required");
      }

      return deps.repository.softDeleteAsset({
        assetId: input.assetId.trim(),
        projectId: input.projectId?.trim() || undefined,
      });
    },
  };
}

export function createPrismaAssetRepository(
  prisma: PrismaClient = defaultPrisma,
): AssetRepository {
  return {
    async createAsset(input) {
      await ensureWorkflowProjectExists(prisma, input.projectId);

      const record = await prisma.asset.create({
        data: {
          projectId: input.projectId,
          type: AssetType.IMAGE,
          url: input.url,
          fileName: input.fileName,
          storageKey: input.storageKey,
        },
      });

      return {
        id: record.id,
        projectId: record.projectId,
        fileName: record.fileName,
        storageKey: record.storageKey,
        url: record.url,
        createdAt: record.createdAt.toISOString(),
      };
    },

    async softDeleteAsset(input) {
      const result = await prisma.asset.deleteMany({
        where: {
          id: input.assetId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
          project: {
            deletedAt: null,
          },
        },
      });

      return result.count > 0;
    },
  };
}
