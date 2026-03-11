import { NextResponse } from "next/server";

import { createAssetService, createPrismaAssetRepository } from "../../../lib/assets/asset.service";
import { prisma } from "../../../lib/db/prisma";
import { createLocalStorage } from "../../../lib/storage/local-storage";

const assetStorage = createLocalStorage({
  rootDir: process.env.LOCAL_STORAGE_ROOT ?? "storage",
});

const assetService = createAssetService({
  storage: assetStorage,
  repository: createPrismaAssetRepository(prisma),
});

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

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("empty")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "failed to upload asset" }, { status: 500 });
  }
}
