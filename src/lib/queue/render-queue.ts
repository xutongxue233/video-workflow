import { Queue, type JobsOptions } from "bullmq";

import type { RenderPayload } from "@/lib/render/render-job.types";

import {
  RENDER_JOB_BACKOFF_DELAY_MS,
  RENDER_JOB_DEFAULT_ATTEMPTS,
  RENDER_QUEUE_NAME,
} from "./queue.constants";
import { getBullMQConnectionOptions } from "./redis";

export function buildRenderQueueJobOptions(idempotencyKey: string): JobsOptions {
  return {
    jobId: idempotencyKey,
    attempts: RENDER_JOB_DEFAULT_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: RENDER_JOB_BACKOFF_DELAY_MS,
    },
    removeOnComplete: 1000,
    removeOnFail: 3000,
  };
}

let renderQueue: Queue<RenderPayload> | null = null;

export function getRenderQueue(): Queue<RenderPayload> {
  if (!renderQueue) {
    renderQueue = new Queue(RENDER_QUEUE_NAME, {
      connection: getBullMQConnectionOptions(),
    }) as Queue<RenderPayload>;
  }

  return renderQueue;
}

export async function enqueueRenderJob(payload: RenderPayload, idempotencyKey: string) {
  return getRenderQueue().add("render", payload, buildRenderQueueJobOptions(idempotencyKey));
}
