import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

type MergeInput = {
  outputRoot: string;
  jobId: string;
  videoUrls: string[];
};

type MergeOutput = {
  storageKey: string;
  url: string;
  absolutePath: string;
};

export function resolveFfmpegCommand(
  env: Record<string, string | undefined> = process.env,
): string {
  const customPath = env.FFMPEG_PATH?.trim();
  if (customPath) {
    return customPath;
  }

  return "ffmpeg";
}

function toFileApiUrl(storageKey: string): string {
  return `/api/files/${storageKey}`;
}

function isSpawnENOENT(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === "ENOENT";
}

function toFfmpegMissingError(command: string): Error {
  return new Error(
    `ffmpeg executable not found (${command}). Install ffmpeg and add it to PATH, or set FFMPEG_PATH in .env`,
  );
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download segment: ${response.status} ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

async function runCommand(command: string, args: string[], cwd?: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const process = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`command failed (${command} ${args.join(" ")}): ${stderr}`));
    });
  });
}

export async function mergeRemoteVideos(input: MergeInput): Promise<MergeOutput> {
  if (input.videoUrls.length === 0) {
    throw new Error("at least one video url is required for merge");
  }

  if (input.videoUrls.length === 1) {
    return {
      storageKey: `external://storyboard/${input.jobId}/shot-1`,
      url: input.videoUrls[0],
      absolutePath: "",
    };
  }

  const absoluteRoot = resolve(input.outputRoot);
  const storageKey = `videos/merged/${input.jobId}.mp4`;
  const absoluteOutputPath = join(absoluteRoot, storageKey);
  const tempDir = await mkdtemp(join(tmpdir(), `video-workflow-merge-${input.jobId}-`));
  const ffmpegCommand = resolveFfmpegCommand();

  try {
    const segmentPaths: string[] = [];
    for (const [index, url] of input.videoUrls.entries()) {
      const segmentPath = join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
      await downloadToFile(url, segmentPath);
      segmentPaths.push(segmentPath);
    }

    const concatListPath = join(tempDir, "concat-list.txt");
    const concatList = segmentPaths.map((path) => `file '${path.replace(/\\/g, "/")}'`).join("\n");
    await writeFile(concatListPath, concatList, "utf8");
    await mkdir(join(absoluteRoot, "videos", "merged"), { recursive: true });

    try {
      await runCommand(ffmpegCommand, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        absoluteOutputPath,
      ]);
    } catch (error) {
      if (isSpawnENOENT(error)) {
        throw toFfmpegMissingError(ffmpegCommand);
      }

      try {
        await runCommand(ffmpegCommand, [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatListPath,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          absoluteOutputPath,
        ]);
      } catch (fallbackError) {
        if (isSpawnENOENT(fallbackError)) {
          throw toFfmpegMissingError(ffmpegCommand);
        }

        throw fallbackError;
      }
    }

    return {
      storageKey,
      url: toFileApiUrl(storageKey),
      absolutePath: absoluteOutputPath,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
