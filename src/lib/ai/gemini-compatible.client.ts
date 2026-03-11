import { z } from "zod";

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z
            .array(
              z.object({
                text: z.string().optional(),
              }),
            )
            .min(1),
        }),
      }),
    )
    .min(1),
});

export type GeminiCompatibleChatClient = {
  createJsonCompletion(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
};

function normalizeModel(model: string): string {
  return model.replace(/^models\//, "");
}

export function createGeminiCompatibleClient(config: {
  baseURL: string;
  apiKey: string;
}): GeminiCompatibleChatClient {
  const normalizedBaseURL = config.baseURL.replace(/\/$/, "");

  return {
    async createJsonCompletion(input) {
      const normalizedModel = normalizeModel(input.model);
      const response = await fetch(
        `${normalizedBaseURL}/models/${normalizedModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              role: "system",
              parts: [{ text: input.systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: input.userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
      }

      const json = geminiResponseSchema.parse(await response.json());
      const content = json.candidates[0]?.content.parts[0]?.text;

      if (!content) {
        throw new Error("Gemini response did not include candidate text");
      }

      return content;
    },
  };
}

