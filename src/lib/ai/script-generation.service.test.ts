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

  it("uses storefront panorama storyboard prompt with required walk-in-traffic claim", async () => {
    const completionClient = {
      createJsonCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "门头展示短片",
          hook: "门头亮起来，客户就会走进来。",
          voiceover: "不用发传单也客流不断，全天自动吸引路过人群。",
          cta: "到店体验门头升级方案。",
          shots: [
            {
              index: 1,
              durationSec: 8,
              visual: "晨光下门头全景推进，招牌发光",
              caption: "第一眼就想进店",
              camera: "无人机缓慢前推",
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
      productName: "社区烘焙店门头",
      sellingPoints: ["夜间高可见", "自然引流"],
      targetAudience: "社区路过行人",
      tone: "真实可信",
      durationSec: 30,
      contentLanguage: "zh-CN",
    });

    const call = completionClient.createJsonCompletion.mock.calls[0]?.[0] as {
      systemPrompt?: string;
    };
    const systemPrompt = call.systemPrompt ?? "";

    expect(systemPrompt).toContain("storefront");
    expect(systemPrompt).toContain("panoramic");
    expect(systemPrompt).toContain("不用发传单也客流不断");
  });

  it("includes reference assets in generation prompt payload", async () => {
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
      contentLanguage: "zh-CN",
      referenceAssets: [
        {
          id: "ast_1",
          projectId: "proj_legacy",
          fileName: "dragon_reference.png",
          url: "/files/assets/dragon_reference.png",
        },
      ],
    });

    const call = completionClient.createJsonCompletion.mock.calls[0]?.[0];
    const promptPayload = JSON.parse(call?.userPrompt ?? "{}") as {
      referenceAssets?: Array<{ id: string; projectId: string; fileName: string; url: string }>;
    };

    expect(promptPayload.referenceAssets).toEqual([
      {
        id: "ast_1",
        projectId: "proj_legacy",
        fileName: "dragon_reference.png",
        url: "/files/assets/dragon_reference.png",
      },
    ]);
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
