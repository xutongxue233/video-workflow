import { describe, expect, it, vi } from "vitest";

import {
  createPrismaScriptGenerationRepository,
  createScriptGenerationService,
} from "./script-generation.service";

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

  it("uses requested content language in generation prompt", async () => {
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

    const service = createScriptGenerationService({
      completionClient,
      repository: {
        createGeneratedScript: vi.fn().mockResolvedValue({
          id: "scr_1",
        }),
      },
      model: "gpt-script-v1",
    });

    await service.generateAndSave({
      projectId: "proj_1",
      productName: "Dragon Mini",
      sellingPoints: ["high detail", "support-friendly"],
      targetAudience: "tabletop gamers",
      tone: "energetic",
      durationSec: 30,
      contentLanguage: "en-US",
    });

    const call = completionClient.createJsonCompletion.mock.calls[0]?.[0];
    const promptPayload = JSON.parse(call?.userPrompt ?? "{}") as {
      language?: string;
    };

    expect(promptPayload.language).toBe("en-US");
  });

  it("ensures project exists before inserting generated script", async () => {
    const teamUpsert = vi.fn().mockResolvedValue({ id: "team_video_workflow_default" });
    const projectUpsert = vi.fn().mockResolvedValue({ id: "proj_demo" });
    const scriptCreate = vi.fn().mockResolvedValue({
      id: "scr_1",
      projectId: "proj_demo",
      title: "t",
      hook: "h",
      sellingPoints: "s",
      storyboard: "sb",
      structuredJson: "{}",
      generatorModel: "m",
      cta: "c",
    });

    const repository = createPrismaScriptGenerationRepository({
      team: { upsert: teamUpsert },
      project: { upsert: projectUpsert },
      script: { create: scriptCreate },
    } as never);

    await repository.createGeneratedScript({
      projectId: "proj_demo",
      title: "t",
      hook: "h",
      sellingPoints: "s",
      storyboard: "sb",
      structuredJson: "{}",
      generatorModel: "m",
      cta: "c",
    });

    expect(teamUpsert).toHaveBeenCalledOnce();
    expect(projectUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proj_demo" },
      }),
    );
    expect(scriptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "proj_demo" }),
      }),
    );
  });
});
