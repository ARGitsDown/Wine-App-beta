import { put } from "@vercel/blob";

// Uploads a scanned label photo to Vercel Blob storage so it can be shown
// back alongside the bottle, instead of being read once by the AI and then
// thrown away. Best-effort and silent on any failure - missing/invalid
// BLOB_READ_WRITE_TOKEN, a network hiccup, whatever - since a bottle should
// still save successfully without its photo either way (same "degrades
// gracefully" spirit as ANTHROPIC_API_KEY being optional for /scan itself).
export async function uploadLabelPhoto(base64Image, mediaType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const extension = mediaType.split("/")[1] || "jpg";
    const filename = `labels/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const blob = await put(filename, Buffer.from(base64Image, "base64"), {
      access: "public",
      contentType: mediaType,
    });
    return blob.url;
  } catch (err) {
    console.error("Failed to upload label photo:", err);
    return null;
  }
}
