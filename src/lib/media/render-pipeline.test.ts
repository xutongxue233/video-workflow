import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { buildOutputVideoPath, runRenderPipeline } from "./render-pipeline";

const tempRoots: string[] = [];

afterEach(() => {
  for (const dir of tempRoots) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

describe("render pipeline", () => {
  it("builds output path using job id", () => {
    const root = mkdtempSync(join(tmpdir(), "video-workflow-"));
    tempRoots.push(root);

    const output = buildOutputVideoPath({
      outputRoot: root,
      jobId: "job_123",
    });

    expect(output).toBe(join(root, "job_123.mp4"));
  });

  it("creates placeholder render artifact and returns metadata", async () => {
    const root = mkdtempSync(join(tmpdir(), "video-workflow-"));
    tempRoots.push(root);

    const result = await runRenderPipeline({
      outputRoot: root,
      jobId: "job_123",
      projectId: "proj_1",
      aspectRatio: "9:16",
    });

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(existsSync(result.outputPath)).toBe(true);
  });
});
