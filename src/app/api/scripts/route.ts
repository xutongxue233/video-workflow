import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createPrismaScriptRepository, createScriptService } from "../../../lib/scripts/script.service";
import { prisma } from "../../../lib/db/prisma";
import { parseLimit } from "../../../lib/http/query";
import { isDeletedProjectError } from "../../../lib/projects/workflow-project";

const scriptService = createScriptService({
  repository: createPrismaScriptRepository(prisma),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limit = parseLimit(url.searchParams.get("limit"), 40);

  const items = await prisma.script.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      project: {
        deletedAt: null,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      title: true,
      hook: true,
      sellingPoints: true,
      storyboard: true,
      cta: true,
      generatorModel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const script = await scriptService.create(body);

    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid script payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (isDeletedProjectError(error)) {
      return NextResponse.json({ message: "project has been deleted" }, { status: 404 });
    }

    return NextResponse.json({ message: "failed to create script" }, { status: 500 });
  }
}
