import "server-only";

import { d1Query } from "@/lib/server/d1";
import { deleteR2Object, listR2Objects, r2KeyFromPublicUrl } from "@/lib/server/r2";

export type R2CleanupScan = {
  count: number;
  totalBytes: number;
  candidates: Array<{ key: string; size: number; lastModified: string | null }>;
};

const APP_PREFIXES = ["hero/", "about/", "gallery/", "marquee/"];
const MIN_AGE_MS = 60 * 60 * 1000;

function oldEnough(lastModified: string | null) {
  if (!lastModified) return true;
  const time = Date.parse(lastModified);
  return !Number.isFinite(time) || Date.now() - time >= MIN_AGE_MS;
}

function addUrlKey(keep: Set<string>, value: unknown) {
  if (typeof value !== "string" || !value) return;
  const key = r2KeyFromPublicUrl(value);
  if (key) keep.add(key);
}

function addPathKey(keep: Set<string>, value: unknown) {
  if (typeof value !== "string" || !value) return;
  if (APP_PREFIXES.some((prefix) => value.startsWith(prefix))) keep.add(value);
}

export async function scanUnusedR2(): Promise<R2CleanupScan> {
  const [home, settings, gallery, marquee] = await Promise.all([
    d1Query<{ image_url: string }>("SELECT image_url FROM home WHERE id = 'main' LIMIT 1"),
    d1Query<{ about_image: string }>("SELECT about_image FROM settings WHERE id = 'main' LIMIT 1"),
    d1Query<{ image_url: string | null; video_url: string | null; image_path: string }>(
      "SELECT image_url, video_url, image_path FROM gallery",
    ),
    d1Query<{ logo_url: string; logo_path: string }>("SELECT logo_url, logo_path FROM marquee"),
  ]);

  const keep = new Set<string>();
  addUrlKey(keep, home.rows[0]?.image_url);
  addUrlKey(keep, settings.rows[0]?.about_image);

  for (const row of gallery.rows) {
    addUrlKey(keep, row.image_url);
    addUrlKey(keep, row.video_url);
    addPathKey(keep, row.image_path);
  }

  for (const row of marquee.rows) {
    addUrlKey(keep, row.logo_url);
    addPathKey(keep, row.logo_path);
  }

  const objects = await listR2Objects();
  const candidates = objects.filter(
    (object) =>
      APP_PREFIXES.some((prefix) => object.key.startsWith(prefix)) &&
      !keep.has(object.key) &&
      oldEnough(object.lastModified),
  );

  return {
    candidates,
    count: candidates.length,
    totalBytes: candidates.reduce((total, object) => total + object.size, 0),
  };
}

export async function deleteUnusedR2() {
  const scan = await scanUnusedR2();
  for (const object of scan.candidates) {
    await deleteR2Object(object.key);
  }
  return scan;
}
