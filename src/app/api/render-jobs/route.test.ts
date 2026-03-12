import { beforeEach, describe, expect, it, vi } from "vitest";

const { renderJobFindMany } = vi.hoisted(() => ({
  renderJobFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    renderJob: {
      findMany: renderJobFindMany,
    },
  },
}));
vi.mock("@/lib/render/storyboard-progress", () => ({
  parseStoryboardProgress: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/render/render-job.queue", () => ({
  createBullMQRenderQueuePort: vi.fn(),
}));
vi.mock("@/lib/render/render-job.repository", () => ({
  createPrismaRenderJobRepository: vi.fn(),
}));
vi.mock("@/lib/render/render-job.service", () => ({
  createRenderJobService: vi.fn(),
}));

import { GET } from "./route";

describe("/api/render-jobs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reference asset snapshot for each render job", async () => {
    renderJobFindMany.mockResolvedValue([
      {
        id: "job_1",
        projectId: "proj_1",
        scriptId: "scr_1",
        voiceStyle: "energetic",
        aspectRatio: "9:16",
        provider: "seadance",
        externalJobId: "ext_1",
        externalStatus: "running",
        status: "RUNNING",
        errorMessage: null,
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        updatedAt: new Date("2026-03-12T00:00:00.000Z"),
        referenceAssetsJson: JSON.stringify([
          {
            id: "asset_1",
            projectId: "proj_1",
            fileName: "dragon.png",
            url: "https://assets.example.com/dragon.png",
          },
        ]),
        video: {
          url: "https://cdn.example.com/out.mp4",
        },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/render-jobs?projectId=proj_1&limit=10"),
    );
    const json = (await response.json()) as {
      items: Array<{
        id: string;
        referenceAssets?: Array<{ id: string; projectId: string; fileName: string | null; url: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    expect(json.items[0]?.referenceAssets).toEqual([
      {
        id: "asset_1",
        projectId: "proj_1",
        fileName: "dragon.png",
        url: "https://assets.example.com/dragon.png",
      },
    ]);
  });
});
