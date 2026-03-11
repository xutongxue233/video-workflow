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

const responsesApiResponseSchema = z.object({
  output_text: z.string().optional(),
  output: z
    .array(
      z.object({
        content: z
          .array(
            z.object({
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
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

function shouldFallbackToResponses(input: { status: number; errorText: string }): boolean {
  return (
    input.status === 400 &&
    (input.errorText.includes("Unsupported legacy protocol") ||
      input.errorText.includes("/v1/responses"))
  );
}

function readResponsesOutput(json: unknown): string {
  const parsed = responsesApiResponseSchema.parse(json);

  if (parsed.output_text) {
    return parsed.output_text;
  }

  const firstText = parsed.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => typeof content.text === "string" && content.text.length > 0)?.text;

  if (firstText) {
    return firstText;
  }

  throw new Error("OpenAI-compatible responses API did not include output text");
}

export function createOpenAICompatibleClient(config: {
  baseURL: string;
  apiKey: string;
}): OpenAICompatibleChatClient {
  const normalizedBaseURL = config.baseURL.replace(/\/$/, "");

  return {
    async createJsonCompletion(input) {
      const commonHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      };

      const response = await fetch(`${normalizedBaseURL}/chat/completions`, {
        method: "POST",
        headers: commonHeaders,
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

        if (shouldFallbackToResponses({ status: response.status, errorText })) {
          const responsesResponse = await fetch(`${normalizedBaseURL}/responses`, {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify({
              model: input.model,
              instructions: input.systemPrompt,
              input: input.userPrompt,
              temperature: 0.4,
            }),
          });

          if (!responsesResponse.ok) {
            const responsesErrorText = await responsesResponse.text();
            throw new Error(
              `OpenAI-compatible request failed: ${responsesResponse.status} ${responsesErrorText}`,
            );
          }

          const responsesRawText = await responsesResponse.text();
          const responsesJson = parseJsonOrThrow({
            rawText: responsesRawText,
            context: "OpenAI-compatible responses endpoint",
          });

          return readResponsesOutput(responsesJson);
        }

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
