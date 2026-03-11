import { AssetType, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../db/prisma";

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
};

type AssetRepository = {
  createAsset(input: CreateAssetRecordInput): Promise<AssetRecord>;
};

type AssetService = {
  uploadImageAsset(input: {
    projectId: string;
    fileName: string;
    content: Buffer;
  }): Promise<AssetRecord>;
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
        url: `/files/${stored.storageKey}`,
      });
    },
  };
}

export function createPrismaAssetRepository(
  prisma: PrismaClient = defaultPrisma,
): AssetRepository {
  return {
    async createAsset(input) {
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
      };
    },
  };
}
