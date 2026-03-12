import { z } from "zod";

const videoCreateResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1).optional(),
});

const videoErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

const videoStatusResponseSchema = z.object({
  id: z.string().min(1).optional(),
  status: z.string().min(1),
  content: z
    .object({
      video_url: z.string().optional(),
      output_url: z.string().optional(),
    })
    .optional(),
  output_url: z.string().optional(),
  error: z.union([z.string(), videoErrorSchema]).optional().nullable(),
});

export type SeaDanceStatus = "queued" | "running" | "succeeded" | "failed";
export type SeaDanceImageRole = "first_frame" | "last_frame" | "reference_image";
export type SeaDanceImageInput = {
  url: string;
  role?: SeaDanceImageRole;
};

export type SeaDanceClient = {
  createVideoJob(input: {
    model: string;
    prompt: string;
    aspectRatio: "9:16" | "16:9";
    imageUrls: string[];
    imageInputs?: SeaDanceImageInput[];
    durationSec: number;
    watermark: boolean;
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
  if (normalized === "cancelled") return "failed";
  if (normalized === "expired") return "failed";
  if (normalized === "failed") return "failed";

  return "running";
}

function resolveApiBase(baseURL: string): string {
  const normalizedBaseURL = baseURL.replace(/\/$/, "");

  if (/\/api\/v3(?:$|\/)/.test(normalizedBaseURL)) {
    return normalizedBaseURL;
  }

  if (/\/v1$/.test(normalizedBaseURL)) {
    return normalizedBaseURL.replace(/\/v1$/, "/api/v3");
  }

  return `${normalizedBaseURL}/api/v3`;
}

function isSeedance15ProModel(model: string): boolean {
  return /seedance-1-5-pro/i.test(model);
}

function normalizeDurationForModel(model: string, durationSec?: number): number {
  const normalized =
    typeof durationSec === "number" && Number.isFinite(durationSec)
      ? Math.floor(durationSec)
      : undefined;

  if (isSeedance15ProModel(model)) {
    if (normalized == null) {
      return -1;
    }

    if (normalized === -1) {
      return -1;
    }

    return Math.max(4, Math.min(12, normalized));
  }

  if (normalized == null || normalized < 2) {
    return 5;
  }

  return Math.max(2, Math.min(12, normalized));
}

function isDataImageUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

async function toDataImageUrl(url: string): Promise<string> {
  if (isDataImageUrl(url)) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return url;
    }

    const contentTypeHeader = response.headers.get("content-type");
    const contentType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase() ?? "";

    if (!contentType.startsWith("image/")) {
      return url;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return url;
  }
}

async function buildContentInput(prompt: string, imageInputs: SeaDanceImageInput[]) {
  const content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        role?: SeaDanceImageRole;
        image_url: {
          url: string;
        };
      }
  > = [];

  content.push({
    type: "text",
    text: prompt,
  });

  for (const imageInput of imageInputs) {
    const encodedUrl = await toDataImageUrl(imageInput.url);
    content.push({
      type: "image_url",
      role: imageInput.role,
      image_url: {
        url: encodedUrl,
      },
    });
  }

  return content;
}

function getErrorMessage(
  error: z.infer<typeof videoStatusResponseSchema>["error"],
): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message ?? error.code;
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
      imageInputs?: SeaDanceImageInput[];
      durationSec?: number;
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
        imageInputs: input.imageInputs,
        durationSec: normalizeDurationForModel(deps.model, input.durationSec),
        watermark: false,
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
  const apiBase = resolveApiBase(config.baseURL);
  const createTaskUrl = `${apiBase}/contents/generations/tasks`;

  return {
    async createVideoJob(input) {
      const imageInputs =
        input.imageInputs && input.imageInputs.length > 0
          ? input.imageInputs
          : input.imageUrls.map((url) => ({
              url,
              role: "reference_image" as const,
            }));

      const response = await fetch(createTaskUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          content: await buildContentInput(input.prompt, imageInputs),
          ratio: input.aspectRatio,
          duration: input.durationSec,
          watermark: input.watermark,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SeaDance create job failed: ${response.status} ${errorText}`);
      }

      const json = videoCreateResponseSchema.parse(await response.json());

      return {
        externalJobId: json.id,
        status: normalizeStatus(json.status ?? "queued"),
      };
    },

    async getVideoJob(externalJobId) {
      const response = await fetch(`${createTaskUrl}/${externalJobId}`, {
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
        videoUrl: json.content?.video_url ?? json.content?.output_url ?? json.output_url,
        errorMessage: getErrorMessage(json.error),
      };
    },
  };
}
