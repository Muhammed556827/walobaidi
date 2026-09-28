import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { d1Execute, d1Query } from "@/lib/server/d1";
import {
  isTableName,
  sanitizeWritePayload,
  validateColumn,
} from "@/lib/db-schema";

export const dynamic = "force-dynamic";

type Body = {
  action?: "insert" | "update" | "delete";
  payload?: Record<string, unknown> | Record<string, unknown>[] | null;
  filter?: { column?: string; value?: unknown } | null;
};

function sqlValue(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || ["string", "number"].includes(typeof value)) return value;
  return JSON.stringify(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ table: string }> },
) {
  try {
    await requireAdmin();
    const { table } = await context.params;
    if (!isTableName(table)) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

    const body = (await request.json()) as Body;
    const action = body.action;
    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

    if (action === "insert") {
      const inputRows = Array.isArray(body.payload) ? body.payload : body.payload ? [body.payload] : [];
      if (inputRows.length === 0) return NextResponse.json({ error: "Missing insert payload" }, { status: 400 });

      const inserted: Record<string, unknown>[] = [];
      for (const input of inputRows) {
        const clean = sanitizeWritePayload(table, input);
        const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
        const now = new Date().toISOString();
        const row: Record<string, unknown> = { id, ...clean, created_at: now, updated_at: now };
        const columns = Object.keys(row);
        const values = columns.map((column) => sqlValue(row[column]));
        await d1Execute(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
          values,
        );
        inserted.push(row);
      }
      return NextResponse.json({ data: inserted });
    }

    const filterColumn = body.filter?.column;
    if (!filterColumn) return NextResponse.json({ error: "A filter is required" }, { status: 400 });
    validateColumn(table, filterColumn);
    const filterValue = sqlValue(body.filter?.value);

    if (action === "update") {
      const clean = sanitizeWritePayload(table, (body.payload || {}) as Record<string, unknown>);
      const entries = Object.entries(clean);
      if (entries.length === 0) return NextResponse.json({ data: [] });
      entries.push(["updated_at", new Date().toISOString()]);
      const sql = `UPDATE ${table} SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE ${filterColumn} = ?`;
      await d1Execute(sql, [...entries.map(([, value]) => sqlValue(value)), filterValue]);
      const updated = await d1Query(`SELECT * FROM ${table} WHERE ${filterColumn} = ?`, [filterValue]);
      return NextResponse.json({ data: updated.rows });
    }

    if (action === "delete") {
      await d1Execute(`DELETE FROM ${table} WHERE ${filterColumn} = ?`, [filterValue]);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database write failed";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Unauthorized" : message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
