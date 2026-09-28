import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/server/d1";
import {
  isTableName,
  normalizeSelectedColumns,
  validateColumn,
} from "@/lib/db-schema";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ table: string }> },
) {
  try {
    const { table } = await context.params;
    if (!isTableName(table)) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

    const search = request.nextUrl.searchParams;
    const selection = normalizeSelectedColumns(table, search.get("select"));
    const order = search.get("order");
    const ascending = search.get("ascending") !== "false";
    const filterColumn = search.get("filterColumn");
    const filterValue = search.get("filterValue");
    const wantsCount = search.get("count") === "exact";
    const head = search.get("head") === "true";
    const rawLimit = Number(search.get("limit") || 0);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 500) : null;

    const where: string[] = [];
    const params: unknown[] = [];
    if (filterColumn) {
      validateColumn(table, filterColumn);
      where.push(`${filterColumn} = ?`);
      params.push(filterValue ?? "");
    }

    let sql = `SELECT ${selection} FROM ${table}`;
    if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
    if (order) {
      validateColumn(table, order);
      sql += ` ORDER BY ${order} ${ascending ? "ASC" : "DESC"}`;
    }
    if (limit) sql += ` LIMIT ${limit}`;

    let count: number | null = null;
    if (wantsCount) {
      let countSql = `SELECT COUNT(*) AS count FROM ${table}`;
      if (where.length) countSql += ` WHERE ${where.join(" AND ")}`;
      const countResult = await d1Query<{ count: number }>(countSql, params);
      count = Number(countResult.rows[0]?.count || 0);
      if (head) {
        return NextResponse.json({ data: [], count }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    const result = await d1Query(sql, params);
    return NextResponse.json(
      { data: result.rows, count },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database read failed" },
      { status: 500 },
    );
  }
}
