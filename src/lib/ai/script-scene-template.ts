import { z } from "zod";

export const scriptSceneTemplateSchema = z.enum(["storefront", "product-demo", "brand-story"]);

export type ScriptSceneTemplate = z.infer<typeof scriptSceneTemplateSchema>;

export const DEFAULT_SCRIPT_SCENE_TEMPLATE: ScriptSceneTemplate = "storefront";

export function normalizeScriptSceneTemplate(input: unknown): ScriptSceneTemplate {
  const parsed = scriptSceneTemplateSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_SCRIPT_SCENE_TEMPLATE;
}

export function getSceneTemplatePromptContext(template: ScriptSceneTemplate): {
  title: string;
  instructions: string[];
  userTaskLabel: string;
} {
  if (template === "product-demo") {
    return {
      title: "Product demo conversion sequence",
      instructions: [
        "Build an educational product-demo arc: pain point -> feature proof -> payoff -> CTA.",
        "Prioritize concrete product capability, avoid storefront-specific assumptions.",
      ],
      userTaskLabel: "Generate product demo short-video script and storyboard",
    };
  }

  if (template === "brand-story") {
    return {
      title: "Brand story narrative sequence",
      instructions: [
        "Build a brand-story arc: identity -> values -> trust proof -> CTA.",
        "Keep claims realistic and avoid unverifiable promises.",
      ],
      userTaskLabel: "Generate brand story short-video script and storyboard",
    };
  }

  return {
    title: "Storefront panorama walk-in conversion sequence",
    instructions: [
      "Primary style: panoramic dynamic storefront showcase.",
      "Focus on trust signal and natural walk-in conversion.",
      "For zh-CN outputs, include the exact phrase \"不用发传单也客流不断\" at least once.",
      "For en-US outputs, include an equivalent claim such as \"Steady walk-in traffic without handing out flyers.\"",
    ],
    userTaskLabel: "Generate storefront panorama short-video script and storyboard",
  };
}
