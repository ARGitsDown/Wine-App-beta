import { put } from "@vercel/blob";

// Uploads a photo to Vercel Blob storage. Returns { url, error: null } on
// success. On failure, `error` distinguishes two very different
// situations for a caller to report: null when blob storage simply isn't
// configured at all (BLOB_READ_WRITE_TOKEN unset - the same graceful-
// degradation spirit as ANTHROPIC_API_KEY being optional for /scan), vs.
// the underlying error's own message when a token IS set but the upload
// itself failed (expired/invalid token, wrong store linked, a network
// hiccup) - that message is what actually explains a failure that
// persists after storage looks correctly configured.
export async function uploadLabelPhoto(base64Image, mediaType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { url: null, error: null };

  try {
    const extension = mediaType.split("/")[1] || "jpg";
    const filename = `labels/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const blob = await put(filename, Buffer.from(base64Image, "base64"), {
      access: "public",
      contentType: mediaType,
    });
    return { url: blob.url, error: null };
  } catch (err) {
    console.error("Failed to upload label photo:", err);
    return { url: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
