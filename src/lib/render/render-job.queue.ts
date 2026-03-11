import { enqueueRenderJob } from "@/lib/queue/render-queue";

import type { RenderQueuePort } from "./render-job.service";
import type { RenderPayload } from "./render-job.types";

export function createBullMQRenderQueuePort(): RenderQueuePort {
  return {
    async enqueue(payload: RenderPayload, idempotencyKey: string): Promise<void> {
      await enqueueRenderJob(payload, idempotencyKey);
    },
  };
}
