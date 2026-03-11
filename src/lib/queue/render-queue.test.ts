import { describe, expect, it } from "vitest";

import { buildRenderQueueJobOptions } from "./render-queue";

describe("render queue options", () => {
  it("builds deterministic BullMQ options from idempotency key", () => {
    const options = buildRenderQueueJobOptions("abc123");

    expect(options.jobId).toBe("abc123");
    expect(options.attempts).toBe(3);
    expect(options.backoff).toEqual({
      type: "exponential",
      delay: 2000,
    });
  });

  it("keeps completed and failed jobs bounded", () => {
    const options = buildRenderQueueJobOptions("abc123");

    expect(options.removeOnComplete).toBe(1000);
    expect(options.removeOnFail).toBe(3000);
  });
});
