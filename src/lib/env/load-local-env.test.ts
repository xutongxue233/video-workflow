import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadEnvFileToProcess } from "./load-local-env";

describe("load local env", () => {
  afterEach(() => {
    delete process.env.TEST_KEY_A;
    delete process.env.TEST_KEY_B;
    delete process.env.TEST_KEY_C;
    delete process.env.FFMPEG_PATH;
  });

  it("loads quoted and unquoted variables from env file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "video-workflow-env-"));
    try {
      await writeFile(
        join(dir, ".env"),
        [
          "TEST_KEY_A=alpha",
          "TEST_KEY_B=\"beta value\"",
          "FFMPEG_PATH=\"D:\\\\Workspace\\\\video-workflow\\\\tools\\\\ffmpeg\\\\bin\\\\ffmpeg.exe\"",
          "# comment",
        ].join("\n"),
        "utf8",
      );

      const loaded = loadEnvFileToProcess({ cwd: dir });

      expect(loaded).toBe(true);
      expect(process.env.TEST_KEY_A).toBe("alpha");
      expect(process.env.TEST_KEY_B).toBe("beta value");
      expect(process.env.FFMPEG_PATH).toBe("D:\\\\Workspace\\\\video-workflow\\\\tools\\\\ffmpeg\\\\bin\\\\ffmpeg.exe");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not override existing process env by default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "video-workflow-env-"));
    process.env.TEST_KEY_C = "from-process";
    try {
      await writeFile(join(dir, ".env"), "TEST_KEY_C=from-file", "utf8");

      const loaded = loadEnvFileToProcess({ cwd: dir });

      expect(loaded).toBe(true);
      expect(process.env.TEST_KEY_C).toBe("from-process");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

