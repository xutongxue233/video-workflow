import type { RenderReferenceAsset } from "./render-job.types";

function toStringOrNull(input: unknown): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (input == null) {
    return null;
  }

  return String(input);
}

export function parseReferenceAssetsJson(raw: string | null): RenderReferenceAsset[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: RenderReferenceAsset[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const projectId = typeof candidate.projectId === "string" ? candidate.projectId.trim() : "";
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      const fileName = toStringOrNull(candidate.fileName);

      if (!id || !projectId || !url) {
        continue;
      }

      normalized.push({
        id,
        projectId,
        url,
        fileName,
      });
    }

    return normalized;
  } catch {
    return [];
  }
}

export function stringifyReferenceAssets(
  referenceAssets: RenderReferenceAsset[] | undefined,
): string | null {
  if (!referenceAssets || referenceAssets.length === 0) {
    return null;
  }

  return JSON.stringify(referenceAssets);
}
