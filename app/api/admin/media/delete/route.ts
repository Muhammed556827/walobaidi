import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { deleteR2Object, r2KeyFromPublicUrl } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : null;
    const suppliedKey = typeof body.key === "string" ? body.key : null;

    const r2Key = r2KeyFromPublicUrl(url) || (suppliedKey?.includes("/") ? suppliedKey : null);
    if (!r2Key) return NextResponse.json({ deleted: false });

    await deleteR2Object(r2Key);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete media file";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
