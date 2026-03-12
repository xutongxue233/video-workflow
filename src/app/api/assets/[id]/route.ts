import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createAssetService, createPrismaAssetRepository } from "../../../../lib/assets/asset.service";
import { prisma } from "../../../../lib/db/prisma";
import { createLocalStorage } from "../../../../lib/storage/local-storage";

const deleteAssetSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
});

const assetStorage = createLocalStorage({
  rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
});

const assetService = createAssetService({
  storage: assetStorage,
  repository: createPrismaAssetRepository(prisma),
});

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const parsed = deleteAssetSchema.parse({
      projectId: url.searchParams.get("projectId")?.trim() || undefined,
    });

    const deleted = await assetService.deleteImageAsset({
      assetId: id,
      projectId: parsed.projectId,
    });

    if (!deleted) {
      return NextResponse.json({ message: "asset not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        assetId: id,
        deleted: true,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid delete payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("assetId is required")) {
      return NextResponse.json({ message: "assetId is required" }, { status: 400 });
    }

    return NextResponse.json({ message: "failed to delete asset" }, { status: 500 });
  }
}
