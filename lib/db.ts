/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

type QueryError = Error | null;
type Result<T> = { data: T | null; error: QueryError; count?: number | null };

type OrderConfig = { ascending?: boolean };
type SelectOptions = { count?: "exact"; head?: boolean };

type Filter = { column: string; value: unknown };

type Operation = "select" | "insert" | "update" | "delete";

class QueryBuilder<T = any> implements PromiseLike<Result<T[]>> {
  private operation: Operation = "select";
  private selection = "*";
  private selectOptions: SelectOptions = {};
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rowLimit: number | null = null;
  private filter: Filter | null = null;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private singleMode: "single" | "maybe" | null = null;

  constructor(private table: string) {}

  select(columns = "*", options: SelectOptions = {}) {
    this.operation = "select";
    this.selection = columns;
    this.selectOptions = options;
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filter = { column, value };
    return this;
  }

  order(column: string, config: OrderConfig = {}) {
    this.orderBy = { column, ascending: config.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  maybeSingle(): Promise<Result<T>> {
    this.singleMode = "maybe";
    return this.execute() as Promise<Result<T>>;
  }

  single(): Promise<Result<T>> {
    this.singleMode = "single";
    return this.execute() as Promise<Result<T>>;
  }

  private async execute(): Promise<Result<T[] | T>> {
    try {
      if (this.operation === "select") {
        const params = new URLSearchParams();
        params.set("select", this.selection);
        if (this.orderBy) {
          params.set("order", this.orderBy.column);
          params.set("ascending", String(this.orderBy.ascending));
        }
        if (this.rowLimit !== null) params.set("limit", String(this.rowLimit));
        if (this.filter) {
          params.set("filterColumn", this.filter.column);
          params.set("filterValue", String(this.filter.value ?? ""));
        }
        if (this.selectOptions.count) params.set("count", this.selectOptions.count);
        if (this.selectOptions.head) params.set("head", "true");

        const response = await fetch(`/api/data/${encodeURIComponent(this.table)}?${params.toString()}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Database read failed");

        const rows = Array.isArray(body.data) ? body.data : [];
        if (this.singleMode === "single") {
          if (rows.length !== 1) throw new Error(rows.length === 0 ? "No row found" : "Multiple rows found");
          return { data: rows[0], error: null, count: body.count ?? null };
        }
        if (this.singleMode === "maybe") {
          if (rows.length > 1) throw new Error("Multiple rows found");
          return { data: rows[0] ?? null, error: null, count: body.count ?? null };
        }
        return { data: rows, error: null, count: body.count ?? null };
      }

      const response = await fetch(`/api/admin/data/${encodeURIComponent(this.table)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: this.operation,
          payload: this.payload,
          filter: this.filter,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Database write failed");
      return { data: body.data ?? null, error: null, count: body.count ?? null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("Database request failed"),
        count: null,
      };
    }
  }

  then<TResult1 = Result<T[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never);
  }
}

export const db = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
};
