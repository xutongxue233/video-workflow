export type SeedreamGeneratedImage = {
  mimeType: string;
  content: Buffer;
};

type SeedreamDataItem = {
  b64_json?: string;
  url?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type SeedreamResponse = {
  data?: SeedreamDataItem[];
  error?: {
    code?: string;
    message?: string;
  };
};

type SeedreamGenerateInput = {
  model: string;
  prompt: string;
  inputImageDataUrls: string[];
  outputCount: number;
  size?: string;
};

type SeedreamClient = {
  generateImages(input: SeedreamGenerateInput): Promise<SeedreamGeneratedImage[]>;
};

function normalizeBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/$/, "");
}

function normalizeApiKey(apiKey: string): string {
  let normalized = apiKey.trim();
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized.replace(/^(SEEDREAM_API_KEY|ARK_API_KEY)\s*=\s*/i, "").trim();
  normalized = normalized.replace(/^Bearer\s+/i, "").trim();
  return normalized;
}

function looksLikeApiKeyPlaceholder(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(normalized)) {
    return true;
  }

  if (/^(YOUR_|YOUR-)?(ARK_|SEEDREAM_)?API_KEY$/i.test(normalized)) {
    return true;
  }

  return false;
}

function looksLikeApiKeyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function toMimeTypeFromDataUrl(dataUrl: string): string {
  const matched = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return matched?.[1]?.toLowerCase() || "image/jpeg";
}

function decodeDataUrlToBuffer(dataUrl: string): Buffer {
  const matched = dataUrl.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  if (!matched?.[1]) {
    throw new Error("invalid image data url from seedream");
  }
  return Buffer.from(matched[1], "base64");
}

function toImageDataPayload(values: string[]): string | string[] {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  return values;
}

export function createOpenAICompatibleSeedreamClient(config: {
  baseURL: string;
  apiKey: string;
}): SeedreamClient {
  return {
    async generateImages(input) {
      if (!input.model.trim()) {
        throw new Error("seedream model is required");
      }
      if (!input.prompt.trim()) {
        throw new Error("seedream prompt is required");
      }
      if (input.inputImageDataUrls.length === 0) {
        throw new Error("at least one input image is required for i2i");
      }

      const normalizedApiKey = normalizeApiKey(config.apiKey);
      if (!normalizedApiKey) {
        throw new Error("seedream api key is required");
      }
      if (looksLikeApiKeyPlaceholder(normalizedApiKey)) {
        throw new Error("seedream api key placeholder detected; use real key value, not $ARK_API_KEY");
      }
      if (looksLikeApiKeyUrl(normalizedApiKey)) {
        throw new Error("seedream api key looks like an endpoint url; check image model config");
      }

      const maxImages = Math.max(1, Math.min(15, Math.floor(input.outputCount || 1)));
      const endpoint = `${normalizeBaseUrl(config.baseURL)}/images/generations`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${normalizedApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          prompt: input.prompt,
          image: toImageDataPayload(input.inputImageDataUrls),
          sequential_image_generation: maxImages > 1 ? "auto" : "disabled",
          sequential_image_generation_options: maxImages > 1 ? { max_images: maxImages } : undefined,
          response_format: "b64_json",
          size: input.size?.trim() || undefined,
          watermark: false,
          stream: false,
        }),
      });

      const rawText = await response.text();
      let parsed: SeedreamResponse = {};
      if (rawText) {
        try {
          parsed = JSON.parse(rawText) as SeedreamResponse;
        } catch {
          throw new Error(`seedream response parse failed: ${rawText}`);
        }
      }

      if (!response.ok) {
        const message = parsed.error?.message || rawText || `HTTP ${response.status}`;
        throw new Error(`seedream image generation failed: ${response.status} ${message}`);
      }

      const items = Array.isArray(parsed.data) ? parsed.data : [];
      if (items.length === 0) {
        throw new Error("seedream returned empty image data");
      }

      const results: SeedreamGeneratedImage[] = [];
      const errors: string[] = [];
      for (const item of items) {
        if (typeof item.b64_json === "string" && item.b64_json.trim()) {
          const dataUrl = `data:image/jpeg;base64,${item.b64_json}`;
          results.push({
            mimeType: toMimeTypeFromDataUrl(dataUrl),
            content: decodeDataUrlToBuffer(dataUrl),
          });
          continue;
        }

        if (item.error?.message) {
          errors.push(item.error.message);
        }
      }

      if (results.length === 0) {
        const message = errors[0] ?? "seedream did not return valid images";
        throw new Error(message);
      }

      return results;
    },
  };
}
