import { describe, expect, it } from "vitest";

import {
  createStoryboardProgress,
  encodeStoryboardProgress,
  parseStoryboardProgress,
  updateStoryboardProgress,
} from "./storyboard-progress";

describe("storyboard progress", () => {
  it("encodes and parses progress snapshot", () => {
    const initial = createStoryboardProgress({
      shots: [
        { shotIndex: 1, durationSec: 5, visual: "shot-1" },
        { shotIndex: 2, durationSec: 6, visual: "shot-2" },
      ],
    });

    const running = updateStoryboardProgress(initial, 1, {
      status: "running",
      externalJobId: "ext_1",
    });

    const serialized = encodeStoryboardProgress(running);
    const parsed = parseStoryboardProgress(serialized);

    expect(parsed).toEqual(
      expect.objectContaining({
        mode: "storyboard_v1",
        total: 2,
        completed: 0,
        failed: 0,
      }),
    );
    expect(parsed?.shots[0]).toEqual(
      expect.objectContaining({
        shotIndex: 1,
        status: "running",
        externalJobId: "ext_1",
      }),
    );
  });

  it("recomputes completed and failed counters from shot status", () => {
    const initial = createStoryboardProgress({
      shots: [
        { shotIndex: 1 },
        { shotIndex: 2 },
        { shotIndex: 3 },
      ],
    });

    const progressed = updateStoryboardProgress(
      updateStoryboardProgress(
        updateStoryboardProgress(initial, 1, { status: "succeeded" }),
        2,
        { status: "failed" },
      ),
      3,
      { status: "running" },
    );

    expect(progressed.completed).toBe(1);
    expect(progressed.failed).toBe(1);
  });
});

