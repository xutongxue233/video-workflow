import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "../../../../lib/db/prisma";
import { createPrismaScriptRepository, createScriptService } from "../../../../lib/scripts/script.service";

const scriptService = createScriptService({
  repository: createPrismaScriptRepository(prisma),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const script = await scriptService.getById(id);

  if (!script) {
    return NextResponse.json({ message: "script not found" }, { status: 404 });
  }

  return NextResponse.json(script, { status: 200 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const script = await scriptService.update(id, body);

    return NextResponse.json(script, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid script update payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "failed to update script" }, { status: 500 });
  }
}
