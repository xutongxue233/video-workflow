import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createPrismaScriptRepository, createScriptService } from "../../../lib/scripts/script.service";
import { prisma } from "../../../lib/db/prisma";

const scriptService = createScriptService({
  repository: createPrismaScriptRepository(prisma),
});

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

    return NextResponse.json({ message: "failed to create script" }, { status: 500 });
  }
}
