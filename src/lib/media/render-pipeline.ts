import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ASPECT_RATIO_DIMENSIONS = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
} as const;

type AspectRatio = keyof typeof ASPECT_RATIO_DIMENSIONS;

export function buildOutputVideoPath(input: { outputRoot: string; jobId: string }): string {
  return join(input.outputRoot, `${input.jobId}.mp4`);
}

export async function runRenderPipeline(input: {
  outputRoot: string;
  jobId: string;
  projectId: string;
  aspectRatio: AspectRatio;
}): Promise<{
  outputPath: string;
  durationSeconds: number;
  width: number;
  height: number;
}> {
  const outputPath = buildOutputVideoPath({
    outputRoot: input.outputRoot,
    jobId: input.jobId,
  });

  const { width, height } = ASPECT_RATIO_DIMENSIONS[input.aspectRatio];

  await mkdir(input.outputRoot, { recursive: true });

  // Placeholder artifact until full FFmpeg/Remotion pipeline is implemented.
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        jobId: input.jobId,
        projectId: input.projectId,
        aspectRatio: input.aspectRatio,
        width,
        height,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    outputPath,
    durationSeconds: 15,
    width,
    height,
  };
}
