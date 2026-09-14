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
import { fileToBase64, downscaleImage } from "@/lib/client-image";
import {
  DEFAULT_SCAN_INTENT,
  SCAN_INTENTS,
  statusForScanIntent,
} from "@/lib/scan-intent";

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

// A whole-batch view of what's happening. Each photo already shows its own
// spinner, but with ten selected there was nothing saying how far along the
// batch as a whole was - so a long run read as indefinite even though every
// piece of it was making progress.
//
// Counts come from the photo list itself rather than a separate tally, so
// choosing more photos mid-run (which appends to the same list) just raises
// the total instead of starting a second, competing count.
function batchProgress(photos) {
  const total = photos.length;
  const done = photos.filter((p) => p.status !== "loading").length;
  const failed = photos.filter((p) => p.status === "error").length;
  // Only wines from photos that actually read - an errored photo still gets
  // one blank card to type into, which isn't a wine anyone found.
  const wines = photos
    .filter((p) => p.status === "ready")
    .reduce((n, p) => n + p.entries.length, 0);
  return { total, done, failed, wines, running: done < total };
}

function BatchProgress({ photos }) {
  const { total, done, failed, wines, running } = batchProgress(photos);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={running ? "text-zinc-500" : "font-medium"}>
          {running ? (
            // Counting completions rather than "photo N of M": several are
            // in flight at once, so there's no single current one.
            <Spinner label={`${done} of ${total} photos read…`} />
          ) : (
            `Read ${total} photo${total === 1 ? "" : "s"} — ${wines} wine${
              wines === 1 ? "" : "s"
            } saved`
          )}
        </span>
        {wines > 0 && running && (
          <span className="text-xs text-zinc-500">
            {wines} wine{wines === 1 ? "" : "s"} so far
          </span>
        )}
        {failed > 0 && !running && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {failed} couldn&apos;t be read
          </span>
        )}
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Photos read"
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 dark:bg-zinc-100"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// An unsaved draft card - for when reading a photo fails outright, or (rarely)
// a specific wine was read successfully but its save to the database failed.
// Nothing exists yet; the existing manual "Save bottle" flow creates it.
function draftEntriesFromWines(wines, intent) {
  return wines.map((extracted) => ({
    localId: nextEntryId++,
    kind: "draft",
    extracted,
    // Same default as a saved card: the batch's intent, not a guess from
    // whether the source happened to carry tasting text. Still just a
    // starting point - change it per entry before saving.
    saveStatus: statusForScanIntent(intent),
    status: "ready",
  }));
}

// A card for a wine extractWinesFromPhoto already saved as a real bottle -
// see that action for why scan saves immediately instead of waiting on a
// manual click. A save failure for one wine falls back to the same draft
// card as a fully-failed photo, rather than losing that wine's read.
function entriesFromScanResults(results, intent) {
  return results.map((result) =>
    result.bottle
      ? { localId: nextEntryId++, kind: "saved", bottle: result.bottle }
      : draftEntriesFromWines([result.wine], intent)[0]
  );
}

export default function ScanPage() {
  const fileInputRef = useRef(null);
  const [intent, setIntent] = useState(DEFAULT_SCAN_INTENT);
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

  async function processPhoto(photo, batchIntent) {
    try {
      const resized = await downscaleImage(photo.file);
      const base64 = await fileToBase64(resized);
      const result = await extractWinesFromPhoto(base64, "image/jpeg", batchIntent);
      if (result.error) {
        // Still offer one blank manual-entry card, through the same
        // entry-card rendering as a successful extraction, rather than a
        // separate code path for the fallback form.
        updatePhoto(photo.id, {
          status: "error",
          error: result.error,
          entries: draftEntriesFromWines([{}], batchIntent),
        });
      } else {
        updatePhoto(photo.id, {
          status: "ready",
          entries: entriesFromScanResults(result.data, batchIntent),
        });
      }
    } catch {
      updatePhoto(photo.id, {
        status: "error",
        error: "Something went wrong reading that photo. Please try again.",
        entries: draftEntriesFromWines([{}], batchIntent),
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

    // Captured now rather than read inside the worker: changing the picker
    // while a batch runs should steer the next batch, not this one.
    const batchIntent = intent;
    await runWithConcurrency(newPhotos, 3, (photo) => processPhoto(photo, batchIntent));
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
          or remove a card you don&apos;t want. Everything in a batch lands
          wherever you pick below; any single wine can be moved afterward on
          its own card.
        </p>
      </div>

      {/* Chosen before the photos, because it's the one thing about a batch
          that can't be read off a label. Each card can still be moved
          individually afterward. */}
      <fieldset className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium">What are you scanning?</legend>
        {SCAN_INTENTS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="scan-intent"
              value={option.value}
              checked={intent === option.value}
              onChange={() => setIntent(option.value)}
              className="mt-1"
            />
            <span>
              {option.label}
              <span className="block text-xs text-zinc-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        className="text-sm"
      />

      <BatchProgress photos={photos} />

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

                      <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <legend className="mb-1 text-zinc-500">Saved to</legend>
                        {[
                          ["inventory", "Inventory"],
                          ["wishlist", "Wishlist"],
                          ["consumed", "Tasting history"],
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
                        submitLabel="Update"
                        idPrefix={`scan-entry-${entry.localId}`}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemove(photo, entry)}
                        className="self-start text-xs text-zinc-500 underline underline-offset-2"
                      >
                        Delete this wine
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

                      <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <legend className="mb-1 text-zinc-500">Save to</legend>
                        {[
                          ["inventory", "Inventory"],
                          ["wishlist", "Wishlist"],
                          ["consumed", "Tasting history"],
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
                        Discard this card
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
