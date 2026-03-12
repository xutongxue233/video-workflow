import { describe, expect, it } from "vitest";

import { resolveFfmpegCommand } from "./video-merge";

describe("video merge ffmpeg command resolution", () => {
  it("uses FFMPEG_PATH when provided", () => {
    const command = resolveFfmpegCommand({
      env: {
        FFMPEG_PATH: "D:/tools/ffmpeg/bin/ffmpeg.exe",
      },
      bundledCommand: null,
    });

    expect(command).toBe("D:/tools/ffmpeg/bin/ffmpeg.exe");
  });

  it("uses bundled ffmpeg command when FFMPEG_PATH is missing", () => {
    const command = resolveFfmpegCommand({
      env: {},
      projectBundledCommand: null,
      bundledCommand: "C:/project/node_modules/ffmpeg-static/ffmpeg.exe",
    });

    expect(command).toBe("C:/project/node_modules/ffmpeg-static/ffmpeg.exe");
  });

  it("prefers repository bundled ffmpeg over ffmpeg-static", () => {
    const command = resolveFfmpegCommand({
      env: {},
      projectBundledCommand: "D:/project/vendor/ffmpeg/win32-x64/ffmpeg.exe",
      bundledCommand: "D:/project/node_modules/ffmpeg-static/ffmpeg.exe",
    });

    expect(command).toBe("D:/project/vendor/ffmpeg/win32-x64/ffmpeg.exe");
  });

  it("falls back to ffmpeg when both custom and bundled commands are missing", () => {
    const command = resolveFfmpegCommand({
      env: {},
      projectBundledCommand: null,
      bundledCommand: null,
    });

    expect(command).toBe("ffmpeg");
  });
});

