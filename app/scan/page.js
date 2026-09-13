"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBottle, extractBottleFromLabel } from "@/app/actions";
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

// Runs `worker` over `items` with at most `concurrency` in flight at once,
// so selecting a big batch of photos doesn't fire dozens of simultaneous AI
// requests.
async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

// A form's `pending` status (from useFormStatus) briefly goes true then
// false when a Server Action submission finishes - this watches for that
// transition to know a card's bottle was saved, without changing how
// BottleForm's action prop works anywhere else it's used.
function SavedWatcher({ onSaved }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) onSaved();
    wasPending.current = pending;
  }, [pending, onSaved]);

  return null;
}

let nextPhotoId = 0;

export default function ScanPage() {
  const fileInputRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  function updatePhoto(id, changes) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  async function processPhoto(photo) {
    try {
      const resized = await downscaleImage(photo.file);
      const base64 = await fileToBase64(resized);
      const result = await extractBottleFromLabel(base64, "image/jpeg");
      if (result.error) {
        updatePhoto(photo.id, { status: "error", error: result.error });
      } else {
        updatePhoto(photo.id, { status: "ready", extracted: result.data });
      }
    } catch {
      updatePhoto(photo.id, {
        status: "error",
        error: "Something went wrong reading that photo. Please try again.",
      });
    }
  }

  async function handleFilesChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newPhotos = files.map((file) => ({
      id: nextPhotoId++,
      previewUrl: URL.createObjectURL(file),
      file,
      status: "loading",
      extracted: null,
      error: null,
      saveStatus: "inventory",
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    event.target.value = "";

    await runWithConcurrency(newPhotos, 3, processPhoto);
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  // Each preview URL otherwise stays alive (and the image data with it) for
  // as long as the tab does. Release whatever's left when leaving the page.
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Scan a label</h1>
        <p className="text-sm text-zinc-500">
          Take or choose one or more photos of wine labels. The AI reads each
          one, checks your own cellar for anything similar, and fills in what
          it can &mdash; you review and confirm each before it&apos;s saved.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        className="text-sm"
      />

      <div className="flex flex-col gap-6">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt="Label preview"
                className="h-32 w-24 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
              />

              <div className="flex flex-1 flex-col gap-2">
                {photo.status === "loading" && (
                  <p className="text-sm text-zinc-500">
                    Reading the label and checking your cellar…
                  </p>
                )}

                {photo.status === "saved" && (
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    ✓ Saved
                  </p>
                )}

                {photo.status === "error" && (
                  <div className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
                    <p>{photo.error}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      You can still add this bottle by hand below.
                    </p>
                  </div>
                )}

                {photo.status === "ready" && !photo.extracted.confident && (
                  <p className="rounded-lg border border-amber-300 p-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-400">
                    Not fully confident about this one &mdash; please
                    double-check the fields below.
                  </p>
                )}

                {photo.status !== "saved" && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="self-start text-xs text-zinc-500 underline underline-offset-2"
                  >
                    Remove from this batch
                  </button>
                )}
              </div>
            </div>

            {(photo.status === "ready" || photo.status === "error") && (
              <>
                <fieldset className="flex gap-4 text-sm">
                  <legend className="mb-1 text-zinc-500">Save to</legend>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`scan-status-${photo.id}`}
                      checked={photo.saveStatus === "inventory"}
                      onChange={() => updatePhoto(photo.id, { saveStatus: "inventory" })}
                    />
                    Inventory
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`scan-status-${photo.id}`}
                      checked={photo.saveStatus === "wishlist"}
                      onChange={() => updatePhoto(photo.id, { saveStatus: "wishlist" })}
                    />
                    Wishlist
                  </label>
                </fieldset>

                <BottleForm
                  action={createBottle.bind(null, photo.saveStatus)}
                  defaultValues={photo.extracted || {}}
                  submitLabel="Save bottle"
                >
                  <SavedWatcher onSaved={() => updatePhoto(photo.id, { status: "saved" })} />
                </BottleForm>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
