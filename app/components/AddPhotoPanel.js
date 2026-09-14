"use client";

import { useRef, useState } from "react";
import { addBottlePhoto } from "@/app/actions";
import { fileToBase64, downscaleImage } from "@/lib/client-image";
import Spinner from "@/app/components/Spinner";

// Lets a bottle collect more than one photo over time - a back label, a
// cork, a case - beyond the single label photo captured at scan time.
// Same trust model as the rest of the app's photo handling: pick a file,
// it's uploaded and attached immediately (there's nothing to review/edit
// about a photo the way there is for scanned/researched fields).
export default function AddPhotoPanel({ bottleId }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const resized = await downscaleImage(file);
      const base64 = await fileToBase64(resized);
      const result = await addBottlePhoto(bottleId, base64, "image/jpeg");
      if (result.error) setError(result.error);
    } catch {
      setError("Something went wrong uploading that photo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        {uploading ? <Spinner label="Uploading…" /> : "Add a photo"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
