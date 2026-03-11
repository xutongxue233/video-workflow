import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  modelProtocolSchema,
} from "../../../lib/models/model-provider.types";
import { fetchProviderModelList } from "../../../lib/models/model-list.service";

const requestSchema = z.object({
  protocol: modelProtocolSchema,
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const models = await fetchProviderModelList(body);

    return NextResponse.json({ models }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "invalid model list payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }

    return NextResponse.json({ message: "failed to list models" }, { status: 500 });
  }
}
