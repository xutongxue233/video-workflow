import { describe, expect, it, vi } from "vitest";

import { createScriptGenerationService } from "./script-generation.service";

describe("script generation service", () => {
  it("generates structured script json and stores it", async () => {
    const completionClient = {
      createJsonCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "Dragon Mini Promo",
          hook: "Print stunning dragons in one night.",
          voiceover: "Meet the miniature dragon everyone wants on their table.",
          cta: "Download and print now.",
          shots: [
            {
              index: 1,
              durationSec: 6,
              visual: "Reveal finished dragon model on rotating stand",
              caption: "Ultra detail, tabletop ready",
              camera: "slow orbit",
            },
          ],
        }),
      ),
    };

    const repository = {
      createGeneratedScript: vi.fn().mockResolvedValue({
        id: "scr_1",
      }),
    };

    const service = createScriptGenerationService({
      completionClient,
      repository,
      model: "gpt-script-v1",
    });

    const result = await service.generateAndSave({
      projectId: "proj_1",
      productName: "Dragon Mini",
      sellingPoints: ["high detail", "support-friendly"],
      targetAudience: "tabletop gamers",
      tone: "energetic",
      durationSec: 30,
    });

    expect(completionClient.createJsonCompletion).toHaveBeenCalledOnce();
    expect(repository.createGeneratedScript).toHaveBeenCalledOnce();
    expect(result.scriptId).toBe("scr_1");
    expect(result.model).toBe("gpt-script-v1");
    expect(result.structuredJson.shots[0].index).toBe(1);
  });

  it("throws when model response is not valid json", async () => {
    const service = createScriptGenerationService({
      completionClient: {
        createJsonCompletion: vi.fn().mockResolvedValue("not-json"),
      },
      repository: {
        createGeneratedScript: vi.fn(),
      },
      model: "gpt-script-v1",
    });

    await expect(
      service.generateAndSave({
        projectId: "proj_1",
        productName: "Dragon Mini",
        sellingPoints: ["high detail"],
        targetAudience: "tabletop gamers",
        tone: "energetic",
        durationSec: 30,
      }),
    ).rejects.toThrow("valid JSON");
  });

  it("throws when model json misses required fields", async () => {
    const service = createScriptGenerationService({
      completionClient: {
        createJsonCompletion: vi.fn().mockResolvedValue(
          JSON.stringify({
            title: "Incomplete",
            hook: "Missing shots",
          }),
        ),
      },
      repository: {
        createGeneratedScript: vi.fn(),
      },
      model: "gpt-script-v1",
    });

    await expect(
      service.generateAndSave({
        projectId: "proj_1",
        productName: "Dragon Mini",
        sellingPoints: ["high detail"],
        targetAudience: "tabletop gamers",
        tone: "energetic",
        durationSec: 30,
      }),
    ).rejects.toThrow("schema");
  });
});
