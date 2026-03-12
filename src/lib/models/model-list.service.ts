import { z } from "zod";

import {
  getDefaultBaseUrlByProtocol,
  type ModelProtocol,
} from "./model-provider.types";

const openAIModelsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
    }),
  ),
});

const geminiModelsResponseSchema = z.object({
  models: z.array(
    z.object({
      name: z.string().min(1),
      displayName: z.string().optional(),
    }),
  ),
});

export type ListedModel = {
  id: string;
  label: string;
};

function normalizeBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/$/, "");
}

async function fetchOpenAICompatibleModels(input: {
  protocol: "openai" | "seedance" | "seedream";
  baseURL: string;
  apiKey: string;
}): Promise<ListedModel[]> {
  const response = await fetch(`${normalizeBaseUrl(input.baseURL)}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`model list failed: ${response.status} ${errorText}`);
  }

  const parsed = openAIModelsResponseSchema.parse(await response.json());

  return parsed.data.map((item) => ({
    id: item.id,
    label: item.id,
  }));
}

async function fetchGeminiCompatibleModels(input: {
  protocol: "gemini" | "google";
  baseURL: string;
  apiKey: string;
}): Promise<ListedModel[]> {
  const response = await fetch(
    `${normalizeBaseUrl(input.baseURL)}/models?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`model list failed: ${response.status} ${errorText}`);
  }

  const parsed = geminiModelsResponseSchema.parse(await response.json());

  return parsed.models.map((item) => ({
    id: item.name,
    label: item.displayName ?? item.name,
  }));
}

export async function fetchProviderModelList(input: {
  protocol: ModelProtocol;
  baseURL?: string;
  apiKey: string;
}): Promise<ListedModel[]> {
  const baseURL = input.baseURL ?? getDefaultBaseUrlByProtocol(input.protocol);

  if (input.protocol === "openai" || input.protocol === "seedance" || input.protocol === "seedream") {
    return fetchOpenAICompatibleModels({
      protocol: input.protocol,
      baseURL,
      apiKey: input.apiKey,
    });
  }

  return fetchGeminiCompatibleModels({
    protocol: input.protocol,
    baseURL,
    apiKey: input.apiKey,
  });
}

