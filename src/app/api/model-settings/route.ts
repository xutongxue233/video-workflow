import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import {
  MODEL_SETTINGS_DB_KEY,
  parsePersistedModelSettings,
} from "../../../lib/models/model-settings-db";

const updateSchema = z.object({
  providers: z.unknown().default([]),
  modelsByProvider: z.unknown().default({}),
});

export async function GET() {
  try {
    const item = await prisma.appConfig.findUnique({
      where: {
        key: MODEL_SETTINGS_DB_KEY,
      },
      select: {
        value: true,
        updatedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        {
          providers: [],
          modelsByProvider: {},
          source: "default",
        },
        { status: 200 },
      );
    }

    let parsedRaw: unknown = {};
    try {
      parsedRaw = JSON.parse(item.value);
    } catch {
      parsedRaw = {};
    }

    const parsed = parsePersistedModelSettings(parsedRaw);
    return NextResponse.json(
      {
        providers: parsed.providers,
        modelsByProvider: parsed.modelsByProvider,
        source: "database",
        updatedAt: item.updatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: "failed to load model settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = updateSchema.parse(await request.json());
    const parsed = parsePersistedModelSettings({
      providers: body.providers,
      modelsByProvider: body.modelsByProvider,
    });

    const payload = JSON.stringify(parsed);
    const updated = await prisma.appConfig.upsert({
      where: {
        key: MODEL_SETTINGS_DB_KEY,
      },
      update: {
        value: payload,
      },
      create: {
        key: MODEL_SETTINGS_DB_KEY,
        value: payload,
      },
      select: {
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        providers: parsed.providers,
        modelsByProvider: parsed.modelsByProvider,
        updatedAt: updated.updatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid model settings payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: "failed to save model settings" }, { status: 500 });
  }
}
