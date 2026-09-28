export const TABLES = {
  home: [
    "id",
    "badge",
    "title",
    "description",
    "button_one",
    "button_two",
    "image_url",
    "created_at",
    "updated_at",
  ],
  settings: [
    "id",
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
    "created_at",
    "updated_at",
  ],
  services: ["id", "title", "description", "created_at", "updated_at"],
  gallery: [
    "id",
    "title",
    "category",
    "image_url",
    "image_path",
    "video_url",
    "media_type",
    "created_at",
    "updated_at",
  ],
  reviews: ["id", "name", "project", "review", "created_at", "updated_at"],
  faq: ["id", "question", "answer", "created_at", "updated_at"],
  marquee: ["id", "title", "logo_url", "logo_path", "created_at", "updated_at"],
} as const;

export type TableName = keyof typeof TABLES;

export function isTableName(value: string): value is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, value);
}

export function allowedColumns(table: TableName) {
  return new Set<string>(TABLES[table]);
}

export function validateColumn(table: TableName, column: string) {
  if (!allowedColumns(table).has(column)) {
    throw new Error(`Column ${column} is not allowed for ${table}.`);
  }
  return column;
}

export function normalizeSelectedColumns(table: TableName, selection: string | null) {
  if (!selection || selection.trim() === "*") return "*";

  const requested = selection
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (requested.length === 0) return "*";
  requested.forEach((column) => validateColumn(table, column));
  return requested.join(", ");
}

export function sanitizeWritePayload(table: TableName, payload: Record<string, unknown>) {
  const allowed = allowedColumns(table);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === "id" || key === "created_at" || key === "updated_at") continue;
    if (allowed.has(key)) result[key] = value;
  }

  return result;
}
