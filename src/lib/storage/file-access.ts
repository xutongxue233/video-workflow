import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export function normalizeStorageKey(storageKey: string): string {
  return storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function resolveStorageFilePath(rootDir: string, storageKey: string): string {
  const absoluteRoot = resolve(rootDir);
  const normalizedKey = normalizeStorageKey(storageKey);
  const normalizedPath = normalize(normalizedKey);
  const absoluteTarget = resolve(absoluteRoot, normalizedPath);

  const rootPrefix = absoluteRoot.endsWith(sep) ? absoluteRoot : `${absoluteRoot}${sep}`;

  if (absoluteTarget !== absoluteRoot && !absoluteTarget.startsWith(rootPrefix)) {
    throw new Error("storage key resolves outside storage root");
  }

  return absoluteTarget;
}

export function guessContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export async function readStoredFile(rootDir: string, storageKey: string): Promise<{
  content: Buffer;
  absolutePath: string;
  contentType: string;
}> {
  const absolutePath = resolveStorageFilePath(rootDir, storageKey);
  const content = await readFile(absolutePath);

  return {
    content,
    absolutePath,
    contentType: guessContentType(absolutePath),
  };
}
