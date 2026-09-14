"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBottleWithNote,
  extractWinesFromPhoto,
  updateBottle,
  setBottleStatus,
  removeScannedBottle,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import Spinner from "@/app/components/Spinner";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Phone photos can be several MB at very high resolution - more than the
// photo reader needs and more than is worth paying to send. Shrinking to a
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

let nextPhotoId = 0;
let nextEntryId = 0;

// An unsaved draft card - for when reading a photo fails outright, or (rarely)
// a specific wine was read successfully but its save to the database failed.
// Nothing exists yet; the existing manual "Save bottle" flow creates it.
function draftEntriesFromWines(wines) {
  return wines.map((extracted) => ({
    localId: nextEntryId++,
    kind: "draft",
    extracted,
    // A wine pulled from a document with its own tasting-note text is
    // treated as already-tasted by default; a plain label defaults to
    // Inventory, as before. Either is just a starting point - change it
    // per entry before saving.
    saveStatus: extracted.note ? "consumed" : "inventory",
    status: "ready",
  }));
}

// A card for a wine extractWinesFromPhoto already saved as a real bottle -
// see that action for why scan saves immediately instead of waiting on a
// manual click. A save failure for one wine falls back to the same draft
// card as a fully-failed photo, rather than losing that wine's read.
function entriesFromScanResults(results) {
  return results.map((result) =>
    result.bottle
      ? { localId: nextEntryId++, kind: "saved", bottle: result.bottle }
      : draftEntriesFromWines([result.wine])[0]
  );
}

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

  function updateEntry(photoId, localId, changes) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id !== photoId
          ? p
          : {
              ...p,
              entries: p.entries.map((e) =>
                e.localId === localId ? { ...e, ...changes } : e
              ),
            }
      )
    );
  }

  // Same shallow-merge idea as updateEntry, but merges into a saved
  // entry's `bottle` (e.g. after changing its status) rather than the
  // entry itself.
  function updateEntryBottle(photoId, localId, patch) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id !== photoId
          ? p
          : {
              ...p,
              entries: p.entries.map((e) =>
                e.localId === localId ? { ...e, bottle: { ...e.bottle, ...patch } } : e
              ),
            }
      )
    );
  }

  function removeEntry(photoId, localId) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id !== photoId
          ? p
          : { ...p, entries: p.entries.filter((e) => e.localId !== localId) }
      )
    );
  }

  // A "saved" entry's bottle already exists in the database, so removing
  // its card has to actually delete that row - a "draft" entry is still
  // just unsaved local state, same as before.
  async function handleRemove(photo, entry) {
    if (entry.kind === "saved") {
      await removeScannedBottle(entry.bottle.id);
    }
    removeEntry(photo.id, entry.localId);
  }

  async function processPhoto(photo) {
    try {
      const resized = await downscaleImage(photo.file);
      const base64 = await fileToBase64(resized);
      const result = await extractWinesFromPhoto(base64, "image/jpeg");
      if (result.error) {
        // Still offer one blank manual-entry card, through the same
        // entry-card rendering as a successful extraction, rather than a
        // separate code path for the fallback form.
        updatePhoto(photo.id, {
          status: "error",
          error: result.error,
          entries: draftEntriesFromWines([{}]),
        });
      } else {
        updatePhoto(photo.id, { status: "ready", entries: entriesFromScanResults(result.data) });
      }
    } catch {
      updatePhoto(photo.id, {
        status: "error",
        error: "Something went wrong reading that photo. Please try again.",
        entries: draftEntriesFromWines([{}]),
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
      error: null,
      entries: [],
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
          Take or choose one or more photos - a bottle label, or a document
          like a shop&apos;s tasting sheet listing several wines. The AI reads
          each one, checks your own cellar for anything similar, and saves
          what it finds right away &mdash; review and correct anything below,
          or remove a card you don&apos;t want.
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
          <div key={photo.id} className="flex flex-col gap-4">
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt="Scanned photo preview"
                className="h-32 w-24 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
              />

              <div className="flex flex-1 flex-col gap-2">
                {photo.status === "loading" && (
                  <p className="text-sm text-zinc-500">
                    <Spinner label="Reading the photo and checking your cellar…" />
                  </p>
                )}

                {photo.status === "ready" && photo.entries.length > 1 && (
                  <p className="text-sm text-zinc-500">
                    Found {photo.entries.length} wines in this photo.
                  </p>
                )}

                {photo.status === "error" && (
                  <div className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
                    <p>{photo.error}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      You can still add a bottle by hand below.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 pl-0 sm:pl-[6.5rem]">
              {photo.entries.map((entry) => (
                <div
                  key={entry.localId}
                  className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  {entry.kind === "saved" ? (
                    <>
                      {entry.bottle.needsResearch && (
                        <p className="rounded-lg border border-amber-300 p-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-400">
                          Not fully confident about this one &mdash; it&apos;s
                          already saved, but please double-check the fields
                          below.
                        </p>
                      )}

                      <fieldset className="flex gap-4 text-sm">
                        <legend className="mb-1 text-zinc-500">Saved to</legend>
                        {[
                          ["inventory", "Inventory"],
                          ["wishlist", "Wishlist"],
                          ["consumed", "History"],
                        ].map(([value, label]) => (
                          <label key={value} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`scan-status-${entry.localId}`}
                              checked={entry.bottle.status === value}
                              onChange={async () => {
                                updateEntryBottle(photo.id, entry.localId, { status: value });
                                await setBottleStatus(entry.bottle.id, value);
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>

                      {entry.bottle.scannedNote && (
                        <p className="text-xs text-zinc-500">
                          Tasting note logged from the photo:{" "}
                          <span className="italic">
                            &ldquo;{entry.bottle.scannedNote}&rdquo;
                          </span>
                        </p>
                      )}

                      <BottleForm
                        action={updateBottle.bind(null, entry.bottle.id)}
                        defaultValues={entry.bottle}
                        submitLabel="Save changes"
                        idPrefix={`scan-entry-${entry.localId}`}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemove(photo, entry)}
                        className="self-start text-xs text-zinc-500 underline underline-offset-2"
                      >
                        Remove this one
                      </button>
                    </>
                  ) : entry.status === "saved" ? (
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Saved
                    </p>
                  ) : (
                    <>
                      {entry.extracted.confident === false && (
                        <p className="rounded-lg border border-amber-300 p-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-400">
                          Not fully confident about this one &mdash; please
                          double-check the fields below.
                        </p>
                      )}

                      <fieldset className="flex gap-4 text-sm">
                        <legend className="mb-1 text-zinc-500">Save to</legend>
                        {[
                          ["inventory", "Inventory"],
                          ["wishlist", "Wishlist"],
                          ["consumed", "History"],
                        ].map(([value, label]) => (
                          <label key={value} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`scan-status-${entry.localId}`}
                              checked={entry.saveStatus === value}
                              onChange={() =>
                                updateEntry(photo.id, entry.localId, { saveStatus: value })
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>

                      <BottleForm
                        action={createBottleWithNote.bind(null, entry.saveStatus)}
                        defaultValues={entry.extracted}
                        submitLabel="Save bottle"
                        includeTastingNote
                        idPrefix={`scan-entry-${entry.localId}`}
                        onResult={(result) => {
                          if (result.success) {
                            updateEntry(photo.id, entry.localId, { status: "saved" });
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemove(photo, entry)}
                        className="self-start text-xs text-zinc-500 underline underline-offset-2"
                      >
                        Remove this one
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {photo.status !== "loading" && (
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="self-start pl-0 text-xs text-zinc-500 underline underline-offset-2 sm:pl-[6.5rem]"
              >
                Remove this photo and all its wines from the batch
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
