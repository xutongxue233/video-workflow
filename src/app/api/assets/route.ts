import { NextResponse } from "next/server";

import { createAssetService, createPrismaAssetRepository } from "../../../lib/assets/asset.service";
import { prisma } from "../../../lib/db/prisma";
import { parseLimit } from "../../../lib/http/query";
import { isDeletedProjectError } from "../../../lib/projects/workflow-project";
import { createLocalStorage } from "../../../lib/storage/local-storage";

const assetStorage = createLocalStorage({
  rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
});

const assetService = createAssetService({
  storage: assetStorage,
  repository: createPrismaAssetRepository(prisma),
});

function normalizeAssetUrl(url: string): string {
  if (url.startsWith("/files/")) {
    return `/api/files/${url.slice("/files/".length)}`;
  }
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 60);

  const items = await prisma.asset.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      project: {
        deletedAt: null,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      type: true,
      fileName: true,
      storageKey: true,
      url: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      items: items.map((item) => ({
        ...item,
        url: normalizeAssetUrl(item.url),
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId");
    const file = formData.get("file");

    if (typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json({ message: "projectId is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    const content = Buffer.from(await file.arrayBuffer());

    const asset = await assetService.uploadImageAsset({
      projectId,
      fileName: file.name,
      content,
    });

    return NextResponse.json(
      {
        ...asset,
        url: normalizeAssetUrl(asset.url),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("empty")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    return NextResponse.json({ message: "failed to upload asset" }, { status: 500 });
  }
}
