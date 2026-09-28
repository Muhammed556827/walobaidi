import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { d1Execute } from "@/lib/server/d1";

type SettingsPayload = {
  business_name: string;
  phone: string;
  email: string;
  hours: string;
  instagram: string;
  facebook: string;
  description: string;
  about_title: string;
  about_description: string;
  about_image: string;
  footer_description: string;
};

const KEYS: Array<keyof SettingsPayload> = [
  "business_name",
  "phone",
  "email",
  "hours",
  "instagram",
  "facebook",
  "description",
  "about_title",
  "about_description",
  "about_image",
  "footer_description",
];

function isSettingsPayload(value: unknown): value is SettingsPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return KEYS.every((key) => typeof row[key] === "string");
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    if (!isSettingsPayload(payload)) {
      return NextResponse.json({ error: "Invalid settings data." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await d1Execute(
      `INSERT INTO settings (
        id, business_name, phone, email, hours, instagram, facebook, description,
        about_title, about_description, about_image, footer_description, created_at, updated_at
      ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        business_name = excluded.business_name,
        phone = excluded.phone,
        email = excluded.email,
        hours = excluded.hours,
        instagram = excluded.instagram,
        facebook = excluded.facebook,
        description = excluded.description,
        about_title = excluded.about_title,
        about_description = excluded.about_description,
        about_image = excluded.about_image,
        footer_description = excluded.footer_description,
        updated_at = excluded.updated_at`,
      [
        payload.business_name,
        payload.phone,
        payload.email,
        payload.hours,
        payload.instagram,
        payload.facebook,
        payload.description,
        payload.about_title,
        payload.about_description,
        payload.about_image,
        payload.footer_description,
        now,
        now,
      ],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
