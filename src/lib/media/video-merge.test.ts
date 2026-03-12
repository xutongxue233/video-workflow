import { describe, expect, it } from "vitest";

import { resolveFfmpegCommand } from "./video-merge";

describe("video merge ffmpeg command resolution", () => {
  it("uses FFMPEG_PATH when provided", () => {
    const command = resolveFfmpegCommand({
      FFMPEG_PATH: "D:/tools/ffmpeg/bin/ffmpeg.exe",
    });

    expect(command).toBe("D:/tools/ffmpeg/bin/ffmpeg.exe");
  });

  it("falls back to ffmpeg when FFMPEG_PATH is missing", () => {
    const command = resolveFfmpegCommand({});

    expect(command).toBe("ffmpeg");
  });
});

