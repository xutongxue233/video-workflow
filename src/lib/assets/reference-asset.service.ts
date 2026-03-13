import type { PrismaClient } from "@prisma/client";

import { readStoredFile } from "../storage/file-access";

export type ResolvedProjectAsset = {
  id: string;
  projectId: string;
  fileName: string | null;
  storageKey: string;
  url: string;
};

export function normalizeAssetApiUrl(url: string): string {
  if (url.startsWith("/files/")) {
    return `/api/files/${url.slice("/files/".length)}`;
  }
  return url;
}

export function toAbsoluteAssetUrl(url: string, requestUrl: string): string {
  const normalizedUrl = normalizeAssetApiUrl(url);
  if (/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  return new URL(normalizedUrl, requestUrl).toString();
}

export function dedupeAssetIds(assetIds: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const rawId of assetIds) {
    const id = rawId.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export async function resolveProjectAssetsByIds(input: {
  prisma: PrismaClient;
  projectId: string;
  assetIds: string[];
}): Promise<ResolvedProjectAsset[]> {
  const dedupedIds = dedupeAssetIds(input.assetIds);
  if (dedupedIds.length === 0) {
    return [];
  }

  const records = await input.prisma.asset.findMany({
    where: {
      id: {
        in: dedupedIds,
      },
      projectId: input.projectId,
      project: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      projectId: true,
      fileName: true,
      storageKey: true,
      url: true,
    },
  });

  const byId = new Map(records.map((item) => [item.id, item]));
  const missingIds = dedupedIds.filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    throw new Error(`reference assets not found in project: ${missingIds.join(",")}`);
  }

  return dedupedIds
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      projectId: item.projectId,
      fileName: item.fileName,
      storageKey: item.storageKey,
      url: normalizeAssetApiUrl(item.url),
    }));
}

export async function toAssetImageDataUrl(input: {
  rootDir: string;
  asset: Pick<ResolvedProjectAsset, "storageKey">;
}): Promise<string> {
  const file = await readStoredFile(input.rootDir, input.asset.storageKey);
  const contentType = file.contentType.toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(`asset is not an image: ${input.asset.storageKey}`);
  }

  return `data:${contentType};base64,${file.content.toString("base64")}`;
}
