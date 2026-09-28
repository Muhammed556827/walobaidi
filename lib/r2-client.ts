export type MediaKind = "hero" | "about" | "gallery" | "marquee";

type UploadResult = {
  key: string;
  publicUrl: string;
};

export async function uploadFileToR2(file: File, kind: MediaKind): Promise<UploadResult> {
  const response = await fetch("/api/admin/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
      kind,
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Could not prepare Cloudflare upload");
  }

  const upload = await fetch(result.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: file,
  });

  if (!upload.ok) {
    throw new Error(
      `Cloudflare upload failed (${upload.status}). Check your R2 CORS settings and environment variables.`,
    );
  }

  return { key: result.key, publicUrl: result.publicUrl };
}

export async function deleteMediaObject(input: {
  key?: string | null;
  url?: string | null;
}) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete media file");
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Could not delete media file");
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError || new Error("Could not delete media file");
}
