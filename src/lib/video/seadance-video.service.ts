import { z } from "zod";

const videoCreateResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
});

const videoStatusResponseSchema = z.object({
  id: z.string().min(1).optional(),
  status: z.string().min(1),
  output_url: z.string().optional(),
  error: z.string().optional(),
});

export type SeaDanceStatus = "queued" | "running" | "succeeded" | "failed";

export type SeaDanceClient = {
  createVideoJob(input: {
    model: string;
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    imageUrls: string[];
  }): Promise<{ externalJobId: string; status: SeaDanceStatus }>;
  getVideoJob(externalJobId: string): Promise<{
    status: SeaDanceStatus;
    videoUrl?: string;
    errorMessage?: string;
  }>;
};

function normalizeStatus(status: string): SeaDanceStatus {
  const normalized = status.toLowerCase();

  if (normalized === "queued") return "queued";
  if (normalized === "running") return "running";
  if (normalized === "succeeded") return "succeeded";
  if (normalized === "failed") return "failed";

  return "running";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createSeaDanceVideoService(deps: {
  client: SeaDanceClient;
  model: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}) {
  return {
    async generateVideo(input: {
      prompt: string;
      aspectRatio: "9:16" | "16:9";
      imageUrls: string[];
    }): Promise<{
      externalJobId: string;
      status: SeaDanceStatus;
      videoUrl?: string;
    }> {
      const created = await deps.client.createVideoJob({
        model: deps.model,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        imageUrls: input.imageUrls,
      });

      const startedAt = Date.now();
      let status: SeaDanceStatus = created.status;
      let videoUrl: string | undefined;

      while (status === "queued" || status === "running") {
        if (Date.now() - startedAt > deps.pollTimeoutMs) {
          throw new Error(`SeaDance job ${created.externalJobId} timed out`);
        }

        await sleep(deps.pollIntervalMs);

        const polled = await deps.client.getVideoJob(created.externalJobId);
        status = polled.status;
        videoUrl = polled.videoUrl;

        if (status === "failed") {
          throw new Error(polled.errorMessage ?? "SeaDance generation failed");
        }
      }

      return {
        externalJobId: created.externalJobId,
        status,
        videoUrl,
      };
    },
  };
}

export function createOpenAICompatibleSeaDanceClient(config: {
  baseURL: string;
  apiKey: string;
}): SeaDanceClient {
  const normalizedBaseURL = config.baseURL.replace(/\/$/, "");

  return {
    async createVideoJob(input) {
      const response = await fetch(`${normalizedBaseURL}/videos/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          prompt: input.prompt,
          aspect_ratio: input.aspectRatio,
          image_urls: input.imageUrls,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SeaDance create job failed: ${response.status} ${errorText}`);
      }

      const json = videoCreateResponseSchema.parse(await response.json());

      return {
        externalJobId: json.id,
        status: normalizeStatus(json.status),
      };
    },

    async getVideoJob(externalJobId) {
      const response = await fetch(`${normalizedBaseURL}/videos/generations/${externalJobId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SeaDance poll failed: ${response.status} ${errorText}`);
      }

      const json = videoStatusResponseSchema.parse(await response.json());

      return {
        status: normalizeStatus(json.status),
        videoUrl: json.output_url,
        errorMessage: json.error,
      };
    },
  };
}
