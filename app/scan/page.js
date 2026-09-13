"use client";

import { useRef, useState } from "react";
import { createBottleFromScan, extractBottleFromLabel } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Phone photos can be several MB at very high resolution - more than the
// label reader needs and more than is worth paying to send. Shrinking to a
// modest max dimension keeps requests fast and cheap without hurting
// readability of the printed text.
function downscaleImage(file, maxDimension = 1568) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image"))),
        "image/jpeg",
        0.85
      );
    };
    image.onerror = () => reject(new Error("Could not load that image"));
    image.src = objectUrl;
  });
}

export default function ScanPage() {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("inventory");
  const [extracted, setExtracted] = useState(null);
  const [confident, setConfident] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setExtracted(null);
    setLoading(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const resized = await downscaleImage(file);
      const base64 = await fileToBase64(resized);
      const result = await extractBottleFromLabel(base64, "image/jpeg");
      if (result.error) {
        setError(result.error);
      } else {
        setExtracted(result.data);
        setConfident(result.data.confident);
      }
    } catch {
      setError("Something went wrong reading that photo. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreviewUrl(null);
    setExtracted(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Scan a label</h1>
        <p className="text-sm text-zinc-500">
          Take a photo of a wine label. The AI reads it, checks your own
          cellar for anything similar, and fills in what it can &mdash; you
          review and confirm before it&apos;s saved.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="text-sm"
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Label preview"
          className="max-h-64 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
        />
      )}

      {loading && (
        <p className="text-sm text-zinc-500">
          Reading the label and checking your cellar…
        </p>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-300 p-3 text-sm text-red-600 dark:border-red-900 dark:text-red-400">
          <p>{error}</p>
          <p className="text-zinc-500 dark:text-zinc-400">
            You can still add this bottle by hand below.
          </p>
        </div>
      )}

      {(extracted || error) && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {extracted && !confident && (
            <p className="rounded-lg border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-900 dark:text-amber-400">
              The AI wasn&apos;t fully confident about this one (it may have
              had to infer the variety or region) &mdash; please double-check
              the fields below before saving.
            </p>
          )}

          <fieldset className="flex gap-4 text-sm">
            <legend className="mb-1 text-zinc-500">Save to</legend>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="scan-status"
                checked={status === "inventory"}
                onChange={() => setStatus("inventory")}
              />
              Inventory
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="scan-status"
                checked={status === "wishlist"}
                onChange={() => setStatus("wishlist")}
              />
              Wishlist
            </label>
          </fieldset>

          <BottleForm
            action={createBottleFromScan.bind(null, status)}
            defaultValues={extracted || {}}
            submitLabel="Save bottle"
          />

          <button
            type="button"
            onClick={reset}
            className="self-start text-sm text-zinc-500 underline underline-offset-2"
          >
            Scan a different photo instead
          </button>
        </div>
      )}
    </div>
  );
}
