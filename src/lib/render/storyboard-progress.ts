import { z } from "zod";

export const storyboardShotProgressSchema = z.object({
  shotIndex: z.number().int().min(1),
  durationSec: z.number().int().min(1).optional(),
  visual: z.string().optional(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  externalJobId: z.string().optional(),
  videoUrl: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type StoryboardShotProgress = z.infer<typeof storyboardShotProgressSchema>;

export const storyboardProgressSchema = z.object({
  mode: z.literal("storyboard_v1"),
  total: z.number().int().min(1),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  shots: z.array(storyboardShotProgressSchema).min(1),
});

export type StoryboardProgress = z.infer<typeof storyboardProgressSchema>;

export function createStoryboardProgress(input: {
  shots: Array<{ shotIndex: number; durationSec?: number; visual?: string }>;
}): StoryboardProgress {
  return {
    mode: "storyboard_v1",
    total: input.shots.length,
    completed: 0,
    failed: 0,
    shots: input.shots.map((item) => ({
      shotIndex: item.shotIndex,
      durationSec: item.durationSec,
      visual: item.visual,
      status: "queued",
    })),
  };
}

function recomputeSummary(progress: StoryboardProgress): StoryboardProgress {
  const completed = progress.shots.filter((shot) => shot.status === "succeeded").length;
  const failed = progress.shots.filter((shot) => shot.status === "failed").length;

  return {
    ...progress,
    completed,
    failed,
  };
}

export function updateStoryboardProgress(
  progress: StoryboardProgress,
  shotIndex: number,
  patch: Partial<StoryboardShotProgress>,
): StoryboardProgress {
  const next = {
    ...progress,
    shots: progress.shots.map((shot) =>
      shot.shotIndex === shotIndex
        ? {
            ...shot,
            ...patch,
          }
        : shot,
    ),
  };

  return recomputeSummary(next);
}

export function encodeStoryboardProgress(progress: StoryboardProgress): string {
  return JSON.stringify(recomputeSummary(progress));
}

export function parseStoryboardProgress(raw: string | null | undefined): StoryboardProgress | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = storyboardProgressSchema.parse(JSON.parse(raw));
    return recomputeSummary(parsed);
  } catch {
    return null;
  }
}

