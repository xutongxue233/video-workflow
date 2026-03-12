import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import ffmpegStatic from "ffmpeg-static";

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

type ResolveFfmpegCommandInput = {
  env?: Record<string, string | undefined>;
  projectBundledCommand?: string | null;
  bundledCommand?: string | null;
};

export function resolveFfmpegCommand(
  input?: ResolveFfmpegCommandInput,
): string {
  const env = input?.env ?? process.env;
  const projectBundledCommand = input && "projectBundledCommand" in input
    ? input.projectBundledCommand
    : resolveProjectBundledFfmpegCommand();
  const bundledCommand = input && "bundledCommand" in input ? input.bundledCommand : ffmpegStatic;
  const customPath = env.FFMPEG_PATH?.trim();
  if (customPath) {
    return customPath;
  }

  if (typeof projectBundledCommand === "string" && projectBundledCommand.trim()) {
    return projectBundledCommand.trim();
  }

  if (typeof bundledCommand === "string" && bundledCommand.trim()) {
    return bundledCommand.trim();
  }

  return "ffmpeg";
}

function resolveProjectBundledFfmpegCommand(): string | null {
  const candidateList: string[] = [];
  if (process.platform === "win32") {
    if (process.arch === "x64") {
      candidateList.push("vendor/ffmpeg/win32-x64/ffmpeg.exe");
    }
    candidateList.push("vendor/ffmpeg/ffmpeg.exe");
  } else if (process.platform === "linux") {
    if (process.arch === "x64") {
      candidateList.push("vendor/ffmpeg/linux-x64/ffmpeg");
    }
    candidateList.push("vendor/ffmpeg/ffmpeg");
  } else if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      candidateList.push("vendor/ffmpeg/darwin-arm64/ffmpeg");
    }
    if (process.arch === "x64") {
      candidateList.push("vendor/ffmpeg/darwin-x64/ffmpeg");
    }
    candidateList.push("vendor/ffmpeg/ffmpeg");
  }

  for (const relativePath of candidateList) {
    const absolutePath = resolve(process.cwd(), relativePath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
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
    `ffmpeg executable not found (${command}). Configure FFMPEG_PATH in .env, install ffmpeg in PATH, or reinstall dependencies to use bundled ffmpeg-static.`,
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
