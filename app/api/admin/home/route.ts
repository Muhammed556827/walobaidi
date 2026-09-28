import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { d1Execute } from "@/lib/server/d1";

type HomePayload = {
  badge: string;
  title: string;
  description: string;
  button_one: string;
  button_two: string;
  image_url: string;
};

function isHomePayload(value: unknown): value is HomePayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["badge", "title", "description", "button_one", "button_two", "image_url"].every(
    (key) => typeof row[key] === "string",
  );
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    if (!isHomePayload(payload)) {
      return NextResponse.json({ error: "Invalid homepage data." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await d1Execute(
      `INSERT INTO home (
        id, badge, title, description, button_one, button_two, image_url, created_at, updated_at
      ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        badge = excluded.badge,
        title = excluded.title,
        description = excluded.description,
        button_one = excluded.button_one,
        button_two = excluded.button_two,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at`,
      [
        payload.badge,
        payload.title,
        payload.description,
        payload.button_one,
        payload.button_two,
        payload.image_url,
        now,
        now,
      ],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save homepage.";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
