import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import {
  createPresignedR2PutUrl,
  makeR2Key,
  publicR2Url,
  type R2MediaKind,
} from "@/lib/server/r2";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set<R2MediaKind>(["hero", "about", "gallery", "marquee"]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 750 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const fileSize = Number(body.fileSize || 0);
    const kind = body.kind as R2MediaKind;

    if (!fileName || !ALLOWED_KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const isVideo = contentType.startsWith("video/");
    const isImage = contentType.startsWith("image/");
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "Only image and video files are allowed" }, { status: 400 });
    }

    if ((kind === "hero" && !isVideo) || (kind === "about" && !isImage) || (kind === "marquee" && !isImage)) {
      return NextResponse.json({ error: "That file type is not allowed in this section" }, { status: 400 });
    }

    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File is too large. Maximum is ${isVideo ? "750 MB" : "25 MB"}.` },
        { status: 400 },
      );
    }

    const key = makeR2Key(kind, fileName);
    return NextResponse.json({
      key,
      publicUrl: publicR2Url(key),
      uploadUrl: createPresignedR2PutUrl(key, 15 * 60),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare upload";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
