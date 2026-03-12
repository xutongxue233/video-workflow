import { z } from "zod";

export type GoogleVideoStatus = "queued" | "running" | "succeeded" | "failed";

export type GoogleVideoClient = {
  createVideoJob(input: {
    model: string;
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    imageUrls: string[];
    imageInputs?: Array<{ url: string; role?: "first_frame" | "last_frame" | "reference_image" }>;
    durationSec?: number;
  }): Promise<{ externalJobId: string; status: GoogleVideoStatus }>;
  getVideoJob(externalJobId: string): Promise<{
    status: GoogleVideoStatus;
    videoUrl?: string;
    errorMessage?: string;
  }>;
};

const googleOperationSchema = z.object({
  name: z.string().optional(),
  done: z.boolean().optional(),
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
  response: z
    .object({
      generatedVideos: z
        .array(
          z.object({
            video: z
              .object({
                uri: z.string().optional(),
                url: z.string().optional(),
              })
              .optional(),
          }),
        )
        .optional(),
      videos: z
        .array(
          z.object({
            uri: z.string().optional(),
            url: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

function normalizeModel(model: string): string {
  return model.replace(/^models\//, "");
}

function normalizeStatus(operation: z.infer<typeof googleOperationSchema>): GoogleVideoStatus {
  if (operation.error) {
    return "failed";
  }

  if (!operation.done) {
    return "running";
  }

  const generatedVideoUrl = operation.response?.generatedVideos?.[0]?.video?.uri;
  const generatedVideoUrlFallback = operation.response?.generatedVideos?.[0]?.video?.url;
  const videosUrl = operation.response?.videos?.[0]?.uri;
  const videosUrlFallback = operation.response?.videos?.[0]?.url;

  if (generatedVideoUrl || generatedVideoUrlFallback || videosUrl || videosUrlFallback) {
    return "succeeded";
  }

  return "failed";
}

function getVideoUrl(operation: z.infer<typeof googleOperationSchema>): string | undefined {
  return (
    operation.response?.generatedVideos?.[0]?.video?.uri ??
    operation.response?.generatedVideos?.[0]?.video?.url ??
    operation.response?.videos?.[0]?.uri ??
    operation.response?.videos?.[0]?.url
  );
}

function getErrorMessage(operation: z.infer<typeof googleOperationSchema>): string | undefined {
  return operation.error?.message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createGoogleVideoService(deps: {
  client: GoogleVideoClient;
  model: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
}) {
  return {
    async generateVideo(input: {
      prompt: string;
      aspectRatio: "9:16" | "16:9";
      imageUrls: string[];
      imageInputs?: Array<{ url: string; role?: "first_frame" | "last_frame" | "reference_image" }>;
      durationSec?: number;
    }): Promise<{
      externalJobId: string;
      status: GoogleVideoStatus;
      videoUrl?: string;
    }> {
      const created = await deps.client.createVideoJob({
        model: deps.model,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        imageUrls: input.imageUrls,
        durationSec: input.durationSec,
      });

      const startedAt = Date.now();
      let status: GoogleVideoStatus = created.status;
      let videoUrl: string | undefined;

      while (status === "queued" || status === "running") {
        if (Date.now() - startedAt > deps.pollTimeoutMs) {
          throw new Error(`Google video job ${created.externalJobId} timed out`);
        }

        await sleep(deps.pollIntervalMs);

        const polled = await deps.client.getVideoJob(created.externalJobId);
        status = polled.status;
        videoUrl = polled.videoUrl;

        if (status === "failed") {
          throw new Error(polled.errorMessage ?? "Google video generation failed");
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

export function createGoogleCompatibleVideoClient(config: {
  baseURL: string;
  apiKey: string;
}): GoogleVideoClient {
  const normalizedBaseURL = config.baseURL.replace(/\/$/, "");

  return {
    async createVideoJob(input) {
      const modelName = normalizeModel(input.model);
      const response = await fetch(
        `${normalizedBaseURL}/models/${modelName}:generateVideos?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: {
              text: input.prompt,
            },
            generationConfig: {
              aspectRatio: input.aspectRatio,
            },
            imageUrls: input.imageUrls,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google video create job failed: ${response.status} ${errorText}`);
      }

      const operation = googleOperationSchema.parse(await response.json());
      const status = normalizeStatus(operation);
      const externalJobId = operation.name;

      if (!externalJobId) {
        throw new Error("Google video operation id is missing");
      }

      if (status === "failed") {
        throw new Error(getErrorMessage(operation) ?? "Google video creation failed");
      }

      return {
        externalJobId,
        status: status === "succeeded" ? "succeeded" : "queued",
      };
    },

    async getVideoJob(externalJobId) {
      const normalizedPath = externalJobId.replace(/^\//, "");
      const response = await fetch(
        `${normalizedBaseURL}/${normalizedPath}?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google video poll failed: ${response.status} ${errorText}`);
      }

      const operation = googleOperationSchema.parse(await response.json());

      return {
        status: normalizeStatus(operation),
        videoUrl: getVideoUrl(operation),
        errorMessage: getErrorMessage(operation),
      };
    },
  };
}

