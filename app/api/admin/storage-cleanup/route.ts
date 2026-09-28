import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { deleteUnusedR2, scanUnusedR2 } from "@/lib/server/r2-cleanup";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const scan = await scanUnusedR2();
    return NextResponse.json({
      count: scan.count,
      totalBytes: scan.totalBytes,
      candidates: scan.candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage scan failed";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "DELETE_UNUSED_STORAGE") {
      return NextResponse.json({ error: "Cleanup confirmation is required." }, { status: 400 });
    }

    const deleted = await deleteUnusedR2();
    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      deletedBytes: deleted.totalBytes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage cleanup failed";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
