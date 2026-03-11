import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  guessContentType,
  readStoredFile,
  resolveStorageFilePath,
} from "./file-access";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

describe("file access", () => {
  it("resolves path for valid storage key", () => {
    const root = mkdtempSync(join(tmpdir(), "video-workflow-files-"));
    tempRoots.push(root);

    const resolved = resolveStorageFilePath(root, "assets/example.png");

    expect(resolved).toBe(join(root, "assets", "example.png"));
  });

  it("rejects path traversal storage key", () => {
    const root = mkdtempSync(join(tmpdir(), "video-workflow-files-"));
    tempRoots.push(root);

    expect(() => resolveStorageFilePath(root, "../secrets.txt")).toThrow(
      "outside storage root",
    );
  });

  it("reads stored file and infers content type", async () => {
    const root = mkdtempSync(join(tmpdir(), "video-workflow-files-"));
    tempRoots.push(root);

    mkdirSync(join(root, "assets"), { recursive: true });
    const filePath = join(root, "assets", "banner.png");
    writeFileSync(filePath, Buffer.from("png-data"));

    const result = await readStoredFile(root, "assets/banner.png");

    expect(result.content.equals(Buffer.from("png-data"))).toBe(true);
    expect(result.contentType).toBe("image/png");
  });

  it("maps unknown extension to octet-stream", () => {
    expect(guessContentType("archive.unknownext")).toBe("application/octet-stream");
  });
});
