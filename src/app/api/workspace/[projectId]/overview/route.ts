import { NextResponse } from "next/server";

import { normalizeAssetApiUrl } from "@/lib/assets/reference-asset.service";
import { prisma } from "@/lib/db/prisma";
import { parseLimit } from "@/lib/http/query";
import { parseReferenceAssetsJson } from "@/lib/render/reference-assets";
import { parseStoryboardProgress } from "@/lib/render/storyboard-progress";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const projectsLimit = parseLimit(url.searchParams.get("projectsLimit"), 60, { max: 100 });
  const assetsLimit = parseLimit(url.searchParams.get("assetsLimit"), 120);
  const scriptsLimit = parseLimit(url.searchParams.get("scriptsLimit"), 30);
  const jobsLimit = parseLimit(url.searchParams.get("jobsLimit"), 30);
  const templatesLimit = parseLimit(url.searchParams.get("templatesLimit"), 80);

  const [project, projects, assets, scripts, renderJobs, promptTemplates] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: normalizedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        _count: {
          select: {
            assets: true,
            scripts: true,
            renderJobs: true,
            videos: true,
          },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: projectsLimit,
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        _count: {
          select: {
            assets: true,
            scripts: true,
            renderJobs: true,
            videos: true,
          },
        },
      },
    }),
    prisma.asset.findMany({
      where: {
        projectId: normalizedProjectId,
        project: {
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: assetsLimit,
      select: {
        id: true,
        projectId: true,
        fileName: true,
        url: true,
        createdAt: true,
      },
    }),
    prisma.script.findMany({
      where: {
        projectId: normalizedProjectId,
        project: {
          deletedAt: null,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: scriptsLimit,
      select: {
        id: true,
        projectId: true,
        title: true,
        hook: true,
        cta: true,
        generatorModel: true,
        updatedAt: true,
      },
    }),
    prisma.renderJob.findMany({
      where: {
        projectId: normalizedProjectId,
        project: {
          deletedAt: null,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: jobsLimit,
      select: {
        id: true,
        projectId: true,
        status: true,
        provider: true,
        scriptId: true,
        externalStatus: true,
        referenceAssetsJson: true,
        updatedAt: true,
        video: {
          select: {
            url: true,
          },
        },
      },
    }),
    prisma.promptTemplate.findMany({
      where: {
        projectId: normalizedProjectId,
        project: {
          deletedAt: null,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: templatesLimit,
      select: {
        id: true,
        projectId: true,
        name: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!project) {
    return NextResponse.json({ message: "project not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        updatedAt: project.updatedAt,
        counts: {
          assets: project._count.assets,
          scripts: project._count.scripts,
          renderJobs: project._count.renderJobs,
          videos: project._count.videos,
        },
      },
      projects: projects.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        updatedAt: item.updatedAt,
        counts: {
          assets: item._count.assets,
          scripts: item._count.scripts,
          renderJobs: item._count.renderJobs,
          videos: item._count.videos,
        },
      })),
      assets: assets.map((item) => ({
        ...item,
        url: normalizeAssetApiUrl(item.url),
      })),
      scripts,
      renderJobs: renderJobs.map((item) => {
        const progress = parseStoryboardProgress(item.externalStatus);
        return {
          id: item.id,
          projectId: item.projectId,
          status: item.status,
          provider: item.provider,
          scriptId: item.scriptId,
          videoUrl: item.video?.url ? normalizeAssetApiUrl(item.video.url) : null,
          referenceAssets: parseReferenceAssetsJson(item.referenceAssetsJson).map((asset) => ({
            ...asset,
            url: normalizeAssetApiUrl(asset.url),
          })),
          updatedAt: item.updatedAt,
          progress: progress
            ? {
                completed: progress.completed,
                total: progress.total,
                failed: progress.failed,
              }
            : null,
        };
      }),
      promptTemplates,
    },
    { status: 200 },
  );
}
