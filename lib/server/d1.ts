import "server-only";

export type D1QueryMeta = {
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
};

type D1QueryResult<T> = {
  success?: boolean;
  results?: T[];
  meta?: D1QueryMeta;
  error?: string;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
  result?: T | T[];
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

export function isD1Configured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() &&
      process.env.CLOUDFLARE_D1_API_TOKEN?.trim(),
  );
}

function config() {
  return {
    accountId: required("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: required("CLOUDFLARE_D1_DATABASE_ID"),
    apiToken: required("CLOUDFLARE_D1_API_TOKEN"),
  };
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; meta: D1QueryMeta }> {
  const { accountId, databaseId, apiToken } = config();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as CloudflareEnvelope<D1QueryResult<T>> | null;

  if (!response.ok || !payload?.success) {
    const detail = payload?.errors?.map((item) => item.message).filter(Boolean).join("; ") ||
      `HTTP ${response.status}`;
    throw new Error(`Cloudflare D1 query failed: ${detail}`);
  }

  const raw = Array.isArray(payload.result) ? payload.result[0] : payload.result;
  if (!raw || raw.success === false) {
    throw new Error(raw?.error || "Cloudflare D1 query did not succeed.");
  }

  return {
    rows: Array.isArray(raw.results) ? raw.results : [],
    meta: raw.meta || {},
  };
}

export async function d1Execute(sql: string, params: unknown[] = []) {
  return d1Query(sql, params);
}
