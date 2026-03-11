import { describe, expect, it, vi } from "vitest";

import { createScriptService } from "./script.service";

describe("script service", () => {
  it("creates script for project", async () => {
    const repository = {
      createScript: vi.fn().mockResolvedValue({
        id: "scr_1",
        projectId: "proj_1",
        hook: "Strong hook",
        cta: "Buy now",
      }),
      updateScript: vi.fn(),
      findById: vi.fn(),
    };

    const service = createScriptService({ repository });

    const result = await service.create({
      projectId: "proj_1",
      hook: "Strong hook",
      cta: "Buy now",
    });

    expect(repository.createScript).toHaveBeenCalledOnce();
    expect(result.id).toBe("scr_1");
  });

  it("updates script by id", async () => {
    const repository = {
      createScript: vi.fn(),
      updateScript: vi.fn().mockResolvedValue({
        id: "scr_1",
        projectId: "proj_1",
        hook: "Updated hook",
        cta: "Updated cta",
      }),
      findById: vi.fn(),
    };

    const service = createScriptService({ repository });

    const result = await service.update("scr_1", {
      hook: "Updated hook",
      cta: "Updated cta",
    });

    expect(repository.updateScript).toHaveBeenCalledOnce();
    expect(result.hook).toBe("Updated hook");
  });

  it("rejects update with empty payload", async () => {
    const service = createScriptService({
      repository: {
        createScript: vi.fn(),
        updateScript: vi.fn(),
        findById: vi.fn(),
      },
    });

    await expect(service.update("scr_1", {})).rejects.toThrow("at least one");
  });
});
