import { NextResponse } from "next/server";

import { readStoredFile } from "../../../../lib/storage/file-access";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ storageKey?: string[] }> },
) {
  const { storageKey } = await context.params;

  if (!storageKey?.length) {
    return NextResponse.json({ message: "storage key is required" }, { status: 400 });
  }

  const joinedKey = storageKey.join("/");
  const rootDir = process.env.LOCAL_STORAGE_ROOT ?? "storage";

  try {
    const file = await readStoredFile(rootDir, joinedKey);

    return new Response(new Uint8Array(file.content), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("outside storage root")) {
      return NextResponse.json({ message: "invalid storage key" }, { status: 400 });
    }

    return NextResponse.json({ message: "file not found" }, { status: 404 });
  }
}
