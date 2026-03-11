import type { TtsProvider } from "../tts.types";

function getFileExtension(contentType: string): string {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("audio/mpeg") || normalized.includes("audio/mp3")) {
    return "mp3";
  }

  if (normalized.includes("audio/ogg")) {
    return "ogg";
  }

  if (normalized.includes("audio/flac")) {
    return "flac";
  }

  if (normalized.includes("audio/aac")) {
    return "aac";
  }

  return "wav";
}

export function createOpenAICompatibleTtsProvider(config: {
  baseURL: string;
  apiKey: string;
  model: string;
  defaultVoice?: string;
}): TtsProvider {
  const normalizedBaseURL = config.baseURL.replace(/\/$/, "");
  const voice = config.defaultVoice?.trim() || "alloy";

  return {
    async synthesize(input) {
      const scriptText = input.scriptText.trim();
      const styleHint = input.voiceStyle.trim();
      const payloadText = styleHint ? `[style: ${styleHint}] ${scriptText}` : scriptText;
      const response = await fetch(`${normalizedBaseURL}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: payloadText,
          voice,
          response_format: "wav",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible TTS request failed: ${response.status} ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") || "audio/wav";

      return {
        content: Buffer.from(arrayBuffer),
        mimeType,
        extension: getFileExtension(mimeType),
        provider: "openai-compatible",
      };
    },
  };
}
