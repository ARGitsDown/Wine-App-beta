"use client";

import { useRef, useState } from "react";
import { addBottlePhoto, extractBottlePhotoDetails, updateBottle } from "@/app/actions";
import { fileToBase64, downscaleImage } from "@/lib/client-image";
import BottleForm from "@/app/components/BottleForm";
import Spinner from "@/app/components/Spinner";

// Lets a bottle collect more than one photo over time - a back label, a
// cork, a case - beyond the single label photo captured at scan time. The
// photo itself is always stored (addBottlePhoto); alongside that, it's
// also read for anything new it shows (extractBottlePhotoDetails) - same
// review-before-save trust model as the Research panel: nothing is
// applied until the user reviews and submits the prefilled form below.
export default function AddPhotoPanel({ bottle, regionOptions }) {
  const fileInputRef = useRef(null);
  const [working, setWorking] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [readError, setReadError] = useState(null);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setWorking(true);
    setUploadError(null);
    setReadError(null);
    setResult(null);
    setApplied(false);
    try {
      const resized = await downscaleImage(file);
      const base64 = await fileToBase64(resized);
      const [uploadResult, detailsResult] = await Promise.all([
        addBottlePhoto(bottle.id, base64, "image/jpeg"),
        extractBottlePhotoDetails(bottle.id, base64, "image/jpeg"),
      ]);
      if (uploadResult.error) setUploadError(uploadResult.error);
      if (detailsResult.error) {
        setReadError(detailsResult.error);
      } else {
        setResult(detailsResult.data);
      }
    } catch {
      setUploadError("Something went wrong with that photo. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
        disabled={working}
        className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        {working ? <Spinner label="Reading photo…" /> : "Add a photo"}
      </button>
      {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
      {readError && <p className="text-sm text-red-600 dark:text-red-400">{readError}</p>}

      {applied && (
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ✓ Applied — details above are updated.
        </p>
      )}

      {result && !applied && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 p-4 dark:border-amber-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Review and edit below — nothing changes until you save.
            </p>
            {/* Closing only discards the proposed field changes; the photo
                itself was uploaded as soon as it was picked, and stays. */}
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Close
            </button>
          </div>
          <BottleForm
            action={updateBottle.bind(null, bottle.id)}
            defaultValues={{ ...bottle, ...result }}
            submitLabel="Apply these changes"
            regionOptions={regionOptions}
            idPrefix="bottle-photo-details"
            onResult={(actionResult) => {
              if (actionResult.success) setApplied(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
