import { z } from "zod";

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

export type OpenAICompatibleChatClient = {
  createJsonCompletion(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
};

function parseJsonOrThrow(input: { rawText: string; context: string }): unknown {
  try {
    return JSON.parse(input.rawText);
  } catch {
    const preview = input.rawText.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `${input.context} did not return JSON. Check protocol/baseURL. Response preview: ${preview}`,
    );
  }
}

export function createOpenAICompatibleClient(config: {
  baseURL: string;
  apiKey: string;
}): OpenAICompatibleChatClient {
  return {
    async createJsonCompletion(input) {
      const response = await fetch(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
          temperature: 0.4,
          response_format: {
            type: "json_object",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible request failed: ${response.status} ${errorText}`);
      }

      const rawText = await response.text();
      const json = parseJsonOrThrow({
        rawText,
        context: "OpenAI-compatible endpoint",
      });
      const parsed = chatCompletionResponseSchema.parse(json);
      const content = parsed.choices[0]?.message.content;

      if (!content) {
        throw new Error("OpenAI-compatible response did not include message content");
      }

      return content;
    },
  };
}
