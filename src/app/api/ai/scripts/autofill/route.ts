import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { REFERENCE_ASSET_SELECTION_LIMIT } from "../../../../../lib/reference-assets.constants";

const runtimeTextModelSchema = z.object({
  protocol: z.enum(["openai", "gemini"]),
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
});

const requestSchema = z.object({
  projectId: z.string().min(1),
  contentLanguage: z.enum(["zh-CN", "en-US"]).optional(),
  referenceAssets: z.array(
    z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      fileName: z.string().min(1),
      url: z.string().min(1),
    }),
  ).min(1).max(REFERENCE_ASSET_SELECTION_LIMIT),
  modelProvider: runtimeTextModelSchema.optional(),
});

const responseSchema = z.object({
  productName: z.string().min(1),
  targetAudience: z.string().min(1),
  sellingPoints: z.array(z.string().min(1)).min(2).max(8),
  tone: z.string().min(1),
  durationSec: z.number().int().min(5).max(60),
});

const openAIChatResponseSchema = z.object({
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

type RuntimeTextModel = {
  protocol: "openai" | "gemini";
  baseURL: string;
  apiKey: string;
  modelId: string;
};

function buildRuntimeTextModel(input: {
  modelProvider?: z.infer<typeof runtimeTextModelSchema>;
}): RuntimeTextModel {
  if (input.modelProvider) {
    return input.modelProvider;
  }

  const baseURL = process.env.OPENAI_COMPAT_BASE_URL;
  const apiKey = process.env.OPENAI_COMPAT_API_KEY;
  const model = process.env.OPENAI_SCRIPT_MODEL;

  if (!baseURL || !apiKey || !model) {
    throw new Error(
      "Missing OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, or OPENAI_SCRIPT_MODEL",
    );
  }

  return {
    protocol: "openai",
    baseURL,
    apiKey,
    modelId: model,
  };
}

function buildSystemPrompt() {
  return [
    "You are a senior campaign-brief analyst for offline storefront customer-acquisition videos.",
    "Primary scenario: storefront panorama showcase (门头全景动态展示) for local walk-in growth.",
    "You MUST infer fields from visual content in images, not from file name strings.",
    "Treat filenames/IDs/URLs as opaque metadata and ignore them for semantic inference.",
    "Preserve storefront identity and avoid fictional assumptions.",
    "Output strict JSON only with keys:",
    "{productName,targetAudience,sellingPoints,tone,durationSec}.",
    "Rules:",
    "- productName: concise storefront/service name grounded in visible signage or scene",
    "- targetAudience: one concrete nearby walk-in persona",
    "- sellingPoints: 3-5 concise, evidence-based points grounded in visible details; include one point expressing \"不用发传单也客流不断\" for zh-CN (or equivalent in en-US)",
    "- tone: one short style word/phrase",
    "- durationSec: integer 15-45 for storefront promo short video",
    "- no markdown, no explanation, no extra keys",
  ].join(" ");
}

function buildUserPrompt(input: z.infer<typeof requestSchema>) {
  return JSON.stringify(
    {
      task: "Autofill short-video generation fields from uploaded assets",
      language: input.contentLanguage ?? "zh-CN",
      projectId: input.projectId,
      imageCount: input.referenceAssets.length,
      businessContext:
        "Local storefront marketing focused on panoramic facade display and natural walk-in conversion",
      requiredSellingClaim: "不用发传单也客流不断",
      outputRules: [
        "Use only what is visually verifiable from images",
        "Do not infer brand/model from filename",
        "Prefer conservative storefront-faithful wording",
        "No exaggerated claims",
      ],
    },
    null,
    2,
  );
}

function isDataImageUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

async function toDataImageUrl(url: string): Promise<string | null> {
  if (isDataImageUrl(url)) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentTypeHeader = response.headers.get("content-type");
    const contentType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function buildDataImageUrls(referenceAssets: z.infer<typeof requestSchema>["referenceAssets"]) {
  const values = await Promise.all(referenceAssets.map((asset) => toDataImageUrl(asset.url)));
  return values.filter((item): item is string => typeof item === "string");
}

function parseDataUrlToGeminiPart(dataUrl: string): { mime_type: string; data: string } | null {
  const matched = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!matched) {
    return null;
  }

  return {
    mime_type: matched[1].toLowerCase(),
    data: matched[2],
  };
}

function normalizeModelForGemini(modelId: string): string {
  return modelId.replace(/^models\//, "");
}

async function requestOpenAIVisionJson(input: {
  model: RuntimeTextModel;
  systemPrompt: string;
  userPrompt: string;
  imageDataUrls: string[];
}): Promise<string> {
  const normalizedBaseURL = input.model.baseURL.replace(/\/$/, "");
  const response = await fetch(`${normalizedBaseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.model.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model.modelId,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: input.userPrompt,
            },
            ...input.imageDataUrls.map((url) => ({
              type: "image_url",
              image_url: {
                url,
              },
            })),
          ],
        },
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI vision request failed: ${response.status} ${errorText}`);
  }

  const json = openAIChatResponseSchema.parse(await response.json());
  const content = json.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenAI vision response did not include message content");
  }

  return content;
}

async function requestGeminiVisionJson(input: {
  model: RuntimeTextModel;
  systemPrompt: string;
  userPrompt: string;
  imageDataUrls: string[];
}): Promise<string> {
  const normalizedBaseURL = input.model.baseURL.replace(/\/$/, "");
  const normalizedModel = normalizeModelForGemini(input.model.modelId);

  const imageParts = input.imageDataUrls
    .map((item) => parseDataUrlToGeminiPart(item))
    .filter((item): item is { mime_type: string; data: string } => item !== null)
    .map((item) => ({
      inline_data: item,
    }));

  const response = await fetch(
    `${normalizedBaseURL}/models/${normalizedModel}:generateContent?key=${encodeURIComponent(input.model.apiKey)}`,
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
            parts: [
              { text: input.userPrompt },
              ...imageParts,
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini vision request failed: ${response.status} ${errorText}`);
  }

  const json = geminiResponseSchema.parse(await response.json());
  const content = json.candidates[0]?.content.parts.find((part) => typeof part.text === "string")?.text;
  if (!content) {
    throw new Error("Gemini vision response did not include candidate text");
  }

  return content;
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const model = buildRuntimeTextModel({ modelProvider: body.modelProvider });
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body);
    const imageDataUrls = await buildDataImageUrls(body.referenceAssets);

    if (imageDataUrls.length === 0) {
      return NextResponse.json(
        { message: "No accessible image content found. Please check reference asset URLs." },
        { status: 422 },
      );
    }

    const raw =
      model.protocol === "gemini"
        ? await requestGeminiVisionJson({
          model,
          systemPrompt,
          userPrompt,
          imageDataUrls,
        })
        : await requestOpenAIVisionJson({
          model,
          systemPrompt,
          userPrompt,
          imageDataUrls,
        });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { message: "model did not return valid JSON", raw },
        { status: 422 },
      );
    }

    const normalized = responseSchema.parse(parsed);
    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid autofill payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("Missing OPENAI_COMPAT_BASE_URL")) {
      return NextResponse.json(
        { message: "No text model configured. Configure one in settings or provide modelProvider." },
        { status: 422 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 422 },
      );
    }

    return NextResponse.json({ message: "failed to autofill script fields" }, { status: 500 });
  }
}
