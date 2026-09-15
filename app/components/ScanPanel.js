"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  createBottleWithNote,
  extractWinesFromPhoto,
  updateBottle,
  setBottleStatus,
  removeScannedBottle,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import Spinner from "@/app/components/Spinner";
import {
  ScanIcon,
  CellarIcon,
  WishlistIcon,
  TastingHistoryIcon,
} from "@/app/components/icons";
import { fileToBase64, downscaleImage } from "@/lib/client-image";
import {
  BOTTLE_DESTINATIONS,
  DEFAULT_SCAN_INTENT,
  SCAN_INTENTS,
  destinationForStatus,
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
  // Only entries that are actually a row in the database. Counting every
  // entry on a photo that read successfully overstated it: one wine's save
  // can fail on an otherwise-fine photo (entriesFromScanResults falls back
  // to an unsaved draft card for it), and an errored photo's blank
  // type-it-in card isn't a wine anyone found either.
  const saved = photos.flatMap((p) => p.entries).filter((e) => e.kind === "saved");
  const wines = saved.length;
  const flagged = saved.filter((e) => e.bottle.needsResearch).length;
  return { total, done, failed, wines, flagged, running: done < total };
}

function BatchProgress({ photos, intent }) {
  const { total, done, failed, wines, flagged, running } = batchProgress(photos);
  if (total === 0) return null;

  // Where this batch was pointed. Individual cards can be re-homed
  // afterward, so this is "where the batch went", not a promise about
  // every wine in it - which is why the link is a plain destination
  // rather than a count of what's waiting there.
  const destination = destinationForStatus(statusForScanIntent(intent));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
        aria-live="polite"
      >
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

      {/* A finished batch used to say what it had done and then stop, leaving
          the user on a page of cards with no way onward except the nav - so
          the last step of "photograph a shelf" was always hunting for proof
          it worked. These are that proof. */}
      {!running && wines > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href={destination.path} className="font-medium underline underline-offset-2">
            View {destination.label}
          </Link>
          {flagged > 0 && (
            <Link
              href="/research"
              className="text-amber-700 underline underline-offset-2 dark:text-amber-400"
            >
              {flagged} need{flagged === 1 ? "s" : ""} research
            </Link>
          )}
        </div>
      )}
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

// `initialIntent` comes from the route's ?intent= param, so Wishlist and
// The cellar can link straight here with the right answer already picked.
// It only seeds the control - the picker below stays visible and editable,
// because a link that silently locked the destination would undo the one
// thing the picker was added to fix.
// How each destination looks on the picker. Same icons and the same accent
// pairs the home screen uses for these places, so the card you tapped to get
// here and the card you tap once you arrive are recognisably the same thing.
const INTENT_LOOK = {
  cellar: {
    Icon: CellarIcon,
    accent: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  wishlist: {
    Icon: WishlistIcon,
    accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  tasting: {
    Icon: TastingHistoryIcon,
    accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  },
};

export default function ScanPanel({ initialIntent = DEFAULT_SCAN_INTENT }) {
  const fileInputRef = useRef(null);
  const [intent, setIntent] = useState(initialIntent);
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
      <h1 className="text-2xl font-semibold">Scan</h1>

      {/* The file input is the point of this page, so it is a real button
          rather than the browser's 20px default - and the destination cards
          above it are what that button means. Hidden rather than sr-only:
          a visually-hidden input is still focusable, which would put a
          second, invisible way to open the picker in the tab order. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        className="hidden"
      />

      {photos.length === 0 ? (
        <>
          <p className="-mt-3 text-sm text-zinc-500">
            A bottle label, a shelf, or a whole tasting sheet. Tap where the
            wines should land.
          </p>

          <fieldset>
            <legend className="sr-only">Where should these wines go?</legend>
            <div className="grid grid-cols-3 gap-2.5">
              {SCAN_INTENTS.map((option) => {
                const look = INTENT_LOOK[option.value];
                const selected = intent === option.value;
                return (
                  <label
                    key={option.value}
                    title={option.hint}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      selected
                        ? "border-2 border-zinc-900 p-[11px] dark:border-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scan-intent"
                      value={option.value}
                      checked={selected}
                      onChange={() => setIntent(option.value)}
                      className="sr-only"
                    />
                    {/* Tinted only when chosen - the strip below encodes
                        selection the same way. Tinting all three and marking
                        the choice with a 2px border alone made the two states
                        of the same control read oppositely, and left the
                        chosen one signalled by the thinner of the two cues. */}
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
                        selected ? look.accent : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      <look.Icon className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-medium leading-tight">
                      {option.short}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-4 text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            <ScanIcon className="h-5 w-5" />
            Take or choose photos
          </button>

          <p className="-mt-2 text-sm text-zinc-500">
            Everything in a batch lands there; any single wine can be moved
            afterward on its own card.
          </p>
        </>
      ) : (
        /* Once cards are stacking up, the picker shrinks to a strip rather
           than disappearing: the destination stays changeable for the next
           batch, which is the whole reason it was a visible control and not
           a locked URL parameter. */
        <div className="flex flex-col gap-1.5">
          {/* The icons alone were cryptic once the cards were gone: a tinted
              circle among two grey ones doesn't say which place it is, or
              that it governs the *next* photos rather than the ones already
              read. The caption does both, and doubles as the group's label. */}
          <span id="scan-intent-strip-label" className="text-xs text-zinc-500">
            Next photos go to{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {SCAN_INTENTS.find((i) => i.value === intent)?.short}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-labelledby="scan-intent-strip-label"
              className="flex gap-2"
            >
              {SCAN_INTENTS.map((option) => {
                const look = INTENT_LOOK[option.value];
                const selected = intent === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setIntent(option.value)}
                    title={`Next photos go to ${option.short}`}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
                      selected
                        ? look.accent
                        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                    }`}
                  >
                    <look.Icon className="h-6 w-6" />
                    <span className="sr-only">{option.short}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              <ScanIcon className="h-4 w-4" />
              Add photos
            </button>
          </div>
        </div>
      )}

      <BatchProgress photos={photos} intent={intent} />

      <div className="flex flex-col gap-6">
        {photos.map((photo) => {
          const savedCount = photo.entries.filter((e) => e.kind === "saved").length;
          return (
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

                  {/* Also for one wine, which is the common case: the card
                      appearing was otherwise the only word that the read had
                      worked. */}
                  {photo.status === "ready" && photo.entries.length > 0 && (
                    <p className="text-sm text-zinc-500">
                      Found {photo.entries.length} wine
                      {photo.entries.length === 1 ? "" : "s"} in this photo.
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
                            already saved, and waiting in{" "}
                            <Link href="/research" className="underline underline-offset-2">
                              Needs research
                            </Link>
                            . Correct it below, or leave it for the app to look
                            up properly later.
                          </p>
                        )}

                        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <legend className="mb-1 text-zinc-500">Saved to</legend>
                          {BOTTLE_DESTINATIONS.map(({ status, label }) => (
                            <label key={status} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`scan-status-${entry.localId}`}
                                checked={entry.bottle.status === status}
                                onChange={async () => {
                                  updateEntryBottle(photo.id, entry.localId, { status });
                                  await setBottleStatus(entry.bottle.id, status);
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

                        {/* This card's bottle is already a row in the
                            database, so this is a real delete - and every other
                            one in the app asks first and says what goes with it.
                            A scan batch is the worst place to be the exception:
                            it's a stack of near-identical cards being thumbed
                            through on a phone. */}
                        <div className="self-start">
                          <ConfirmButton
                            action={() => handleRemove(photo, entry)}
                            label="Delete this wine"
                            confirmLabel="Yes, delete"
                            warning={
                              entry.bottle.scannedNote
                                ? "Also deletes the tasting note read from the photo."
                                : "Removes it from your cellar for good."
                            }
                            className="text-xs text-zinc-500 underline underline-offset-2"
                            confirmClassName="text-xs font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
                          />
                        </div>
                      </>
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
                          {BOTTLE_DESTINATIONS.map(({ status, label }) => (
                            <label key={status} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`scan-status-${entry.localId}`}
                                checked={entry.saveStatus === status}
                                onChange={() =>
                                  updateEntry(photo.id, entry.localId, { saveStatus: status })
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
                          // Saving used to replace the whole card with a
                          // "✓ Saved" line, which threw away the form, the
                          // values and any route back to what had just been
                          // created - on the one path where every field was
                          // typed by hand and a typo is likeliest. Handing the
                          // card over to the saved rendering above keeps all
                          // three, and makes the two ways a wine gets saved
                          // behave the same afterward.
                          onResult={(result) => {
                            if (result.success && result.bottle) {
                              updateEntry(photo.id, entry.localId, {
                                kind: "saved",
                                bottle: result.bottle,
                              });
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

              {/* This only drops the photo from the page - the wines it read
                  are already saved and stay saved. The old label ("...and all
                  its wines from the batch") read as an undo, so photographing
                  the wrong shelf and tapping this looked like it had been put
                  right when in fact those bottles were still in the cellar,
                  now with nothing on screen saying so. Deleting them outright
                  would be a worse answer: that is several bottles gone on one
                  tap, which is exactly what the per-card confirm above exists
                  to prevent. */}
              {photo.status !== "loading" && (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="self-start pl-0 text-xs text-zinc-500 underline underline-offset-2 sm:pl-[6.5rem]"
                >
                  {savedCount > 0
                    ? `Hide this photo — its ${savedCount} saved wine${
                        savedCount === 1 ? "" : "s"
                      } stay${savedCount === 1 ? "s" : ""} in your collection`
                    : "Remove this photo"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
