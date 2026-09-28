import { createHash, createHmac, randomUUID } from "node:crypto";

export type R2MediaKind = "hero" | "about" | "gallery" | "marquee";

export type R2ObjectInfo = {
  key: string;
  size: number;
  lastModified: string | null;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

const REGION = "auto";
const SERVICE = "s3";

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

export function getR2Config(): R2Config {
  return {
    accountId: env("R2_ACCOUNT_ID"),
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    bucket: env("R2_BUCKET_NAME"),
    publicBaseUrl: env("R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  };
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim() &&
      process.env.R2_PUBLIC_BASE_URL?.trim(),
  );
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(value: string) {
  return value
    .split("/")
    .map((part) => awsEncode(part))
    .join("/");
}

function amzTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQuery(params: Array<[string, string]>) {
  return params
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function signingKey(secret: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function signatureFor({
  method,
  canonicalUri,
  query,
  canonicalHeaders,
  signedHeaders,
  payloadHash,
  amzDate,
  dateStamp,
  secretAccessKey,
}: {
  method: string;
  canonicalUri: string;
  query: string;
  canonicalHeaders: string;
  signedHeaders: string;
  payloadHash: string;
  amzDate: string;
  dateStamp: string;
  secretAccessKey: string;
}) {
  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  return createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");
}

function endpointParts(key?: string) {
  const config = getR2Config();
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const bucketPath = `/${awsEncode(config.bucket)}`;
  const objectPath = key ? `/${encodePath(key)}` : "";
  return {
    config,
    host,
    canonicalUri: `${bucketPath}${objectPath}`,
    url: `https://${host}${bucketPath}${objectPath}`,
  };
}

export function publicR2Url(key: string) {
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${encodePath(key)}`;
}

export function r2KeyFromPublicUrl(value: string | null | undefined) {
  if (!value || !process.env.R2_PUBLIC_BASE_URL?.trim()) return null;

  try {
    const base = new URL(process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/+$/, "") + "/");
    const url = new URL(value);
    if (url.origin !== base.origin) return null;

    const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    if (!url.pathname.startsWith(basePath)) return null;

    const encodedKey = url.pathname.slice(basePath.length);
    return encodedKey ? decodeURIComponent(encodedKey) : null;
  } catch {
    return null;
  }
}

export function makeR2Key(kind: R2MediaKind, fileName: string) {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
  return `${kind}/${Date.now()}-${randomUUID()}-${safeName}`;
}

export function createPresignedR2PutUrl(key: string, expiresIn = 900) {
  const { config, host, canonicalUri, url } = endpointParts(key);
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Content-Sha256", payloadHash],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(Math.max(1, Math.min(expiresIn, 604800)))],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];

  const query = canonicalQuery(params);
  const canonicalHeaders = `host:${host}\n`;
  const signature = signatureFor({
    method: "PUT",
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    amzDate,
    dateStamp,
    secretAccessKey: config.secretAccessKey,
  });

  return `${url}?${query}&X-Amz-Signature=${signature}`;
}

async function signedR2Request({
  method,
  key,
  queryParams = [],
}: {
  method: "GET" | "DELETE" | "HEAD";
  key?: string;
  queryParams?: Array<[string, string]>;
}) {
  const { config, host, canonicalUri, url } = endpointParts(key);
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const query = canonicalQuery(queryParams);
  const signature = signatureFor({
    method,
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    amzDate,
    dateStamp,
    secretAccessKey: config.secretAccessKey,
  });
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return fetch(`${url}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    cache: "no-store",
  });
}

export async function deleteR2Object(key: string) {
  const response = await signedR2Request({ method: "DELETE", key });
  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "");
    throw new Error(`R2 delete failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]) : null;
}

export async function listR2Objects(prefix = ""): Promise<R2ObjectInfo[]> {
  const objects: R2ObjectInfo[] = [];
  let continuationToken: string | null = null;

  do {
    const queryParams: Array<[string, string]> = [
      ["list-type", "2"],
      ["max-keys", "1000"],
    ];
    if (prefix) queryParams.push(["prefix", prefix]);
    if (continuationToken) queryParams.push(["continuation-token", continuationToken]);

    const response = await signedR2Request({ method: "GET", queryParams });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`R2 list failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }

    const xml = await response.text();
    const contentBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    for (const block of contentBlocks) {
      const key = xmlValue(block, "Key");
      if (!key) continue;
      objects.push({
        key,
        size: Number(xmlValue(block, "Size") || 0),
        lastModified: xmlValue(block, "LastModified"),
      });
    }

    const truncated = xmlValue(xml, "IsTruncated") === "true";
    continuationToken = truncated ? xmlValue(xml, "NextContinuationToken") : null;
  } while (continuationToken);

  return objects;
}
