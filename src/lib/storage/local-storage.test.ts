import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalStorage } from "./local-storage";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("local storage", () => {
  it("writes buffer under scoped key and returns absolute path", async () => {
    const root = join(tmpdir(), `video-workflow-storage-${Date.now()}`);
    tempDirs.push(root);

    const storage = createLocalStorage({ rootDir: root });
    const result = await storage.saveBuffer({
      scope: "assets",
      fileName: "example.png",
      content: Buffer.from("hello"),
    });

    expect(result.storageKey.startsWith("assets/")).toBe(true);
    expect(result.absolutePath).toBe(join(root, result.storageKey));
    expect(existsSync(result.absolutePath)).toBe(true);
  });

  it("keeps original extension when generating storage key", async () => {
    const root = join(tmpdir(), `video-workflow-storage-${Date.now()}-2`);
    tempDirs.push(root);

    const storage = createLocalStorage({ rootDir: root });
    const result = await storage.saveBuffer({
      scope: "tts",
      fileName: "voice.wav",
      content: Buffer.from("audio"),
    });

    expect(result.storageKey.endsWith(".wav")).toBe(true);
  });
});
