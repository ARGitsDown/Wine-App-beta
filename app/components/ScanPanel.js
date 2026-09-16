"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBottleWithNote,
  extractWinesFromPhoto,
  updateBottle,
  setBottleStatus,
  removeScannedBottle,
  removeScannedBottles,
  dismissResearch,
  researchBottle,
} from "@/app/actions";
import Link from "next/link";
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
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import { wineDetail } from "@/lib/wine-origin";
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
  // one blank card to type into, which isn't a wine anyone found - and,
  // within those, only the ones that reached the database. A wine whose
  // save failed is still on screen as a draft card, so counting entries
  // rather than saves reported it as "saved" when nothing had been stored.
  const ready = photos.filter((p) => p.status === "ready");
  const wines = ready.reduce(
    (n, p) => n + p.entries.filter((e) => e.kind === "saved").length,
    0
  );
  const unsaved = ready.reduce(
    (n, p) => n + p.entries.filter((e) => e.kind !== "saved").length,
    0
  );
  return { total, done, failed, wines, unsaved, running: done < total };
}

// What clearing the screen would cost. A blank manual card nobody typed into
// is not a loss; a wine read from a photo whose save failed is, and so is a
// card someone has edited without saving.
function pendingLoss(photos) {
  let drafts = 0;
  let edits = 0;
  for (const photo of photos) {
    for (const entry of photo.entries) {
      if (entry.dirty) edits += 1;
      else if (entry.kind !== "saved" && entry.status !== "saved" && entry.saveFailed) {
        drafts += 1;
      }
    }
  }
  return { drafts, edits, any: drafts + edits > 0 };
}

// Finishing a batch is not the same as undoing it, and until this existed the
// app could only do the second: every control that emptied the page deleted
// bottles, so the way to get a clean screen after a good scan was to reload
// the page. Everything here is already saved - this clears the workspace and
// keeps the wine.
function DoneButton({ photos, onDone }) {
  const { drafts, edits, any } = pendingLoss(photos);
  const className =
    "rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:outline-zinc-100";

  if (!any) {
    return (
      <button type="button" onClick={onDone} className={className}>
        Done &mdash; clear the screen
      </button>
    );
  }

  const parts = [];
  if (edits > 0) parts.push(`${edits} card${edits === 1 ? "" : "s"} with unsaved edits`);
  if (drafts > 0) parts.push(`${drafts} wine${drafts === 1 ? "" : "s"} still to save`);

  return (
    <ConfirmButton
      action={onDone}
      label="Done &mdash; clear the screen"
      confirmLabel="Clear it anyway"
      warning={`Loses ${parts.join(" and ")}. Wines already saved are kept.`}
      className={className}
      confirmClassName="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white dark:bg-red-800"
    />
  );
}

function BatchProgress({ photos, onDone }) {
  const { total, done, failed, wines, unsaved, running } = batchProgress(photos);
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
        {unsaved > 0 && !running && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {unsaved} still to save
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

      {/* Nothing told a screen reader the batch had finished: the bar's
          aria-valuenow isn't announced, and the visible summary is only
          read if you happen to navigate back to it. Deliberately its own
          region with only two states rather than role="status" on the
          running text above, which would announce on every completed
          photo - nine interruptions to say the same thing nine times. */}
      {!running && (
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <DoneButton photos={photos} onDone={onDone} />
          <span className="text-xs text-zinc-500">
            Everything above is already saved &mdash; this just puts the page
            away.
          </span>
        </div>
      )}

      <p className="sr-only" role="status">
        {running
          ? `Reading ${total} photo${total === 1 ? "" : "s"}.`
          : [
              `Finished reading ${total} photo${total === 1 ? "" : "s"}.`,
              `${wines} wine${wines === 1 ? "" : "s"} saved.`,
              unsaved > 0 ? `${unsaved} still to save.` : null,
              failed > 0 ? `${failed} couldn't be read.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
      </p>
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
      : // Flagged so the card can say why it is still a draft. Otherwise it
        // looks exactly like a wine read from a photo that failed outright,
        // and the only hint that this one needs a click is the word "Save"
        // instead of "Saved" in its legend.
        { ...draftEntriesFromWines([result.wine], intent)[0], saveFailed: true }
  );
}

// What the wine actually is, in one line - deliberately the same shape the
// cellar list uses, so a wine read from a photo is described the way you
// already read wines everywhere else in the app. Until this existed the only
// way to see what had been found was to read it off the form fields.
// Producer, bottling and vintage in one line, the shape the cellar list uses.
function wineTitle(wine) {
  return [
    wine.producer,
    wine.bottling ? `\u201c${wine.bottling}\u201d` : null,
    wine.vintage || null,
  ]
    .filter(Boolean)
    .join(" ");
}

function EntryHeading({ wine }) {
  const title = wineTitle(wine);
  const detail = wineDetail(wine);

  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-medium">
        {WINE_COLOR_SWATCH[wine.wineColor] && (
          <span
            className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${WINE_COLOR_SWATCH[wine.wineColor]}`}
            title={wine.wineColor}
          />
        )}
        {title}
      </p>
      {detail && <p className="text-sm text-zinc-500">{detail}</p>}
    </div>
  );
}

// Removing a photo takes every wine it produced with it, which can be
// several real bottles at once - so it asks first whenever there is anything
// saved to lose, and stays a plain link when the photo only left drafts
// behind. The count is in the button itself because "all its wines" doesn't
// say how many that is once the card has scrolled.
function RemovePhotoButton({ photo, onRemove }) {
  const saved = photo.entries.filter((e) => e.kind === "saved").length;
  const dirty = photo.entries.filter((e) => e.dirty).length;
  // Says delete, because that is what it does. It used to read "remove this
  // photo and all its wines from the batch", which sounded like tidying up
  // even after it started deleting - and now that Done actually is the
  // tidying-up control, the difference has to be visible in the words.
  const label =
    saved === 0
      ? "Remove this photo"
      : `Delete ${saved === 1 ? "this wine" : `these ${saved} wines`}`;
  const linkClass =
    "-mx-2 rounded px-2 py-2 text-xs text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100";

  if (saved === 0 && dirty === 0) {
    return (
      <button
        type="button"
        onClick={onRemove}
        className={`self-start sm:ml-[6.5rem] ${linkClass}`}
      >
        {label}
      </button>
    );
  }

  // Two different losses, and either one alone is worth a pause: bottles
  // that would be deleted, and edits typed but not yet saved.
  const parts = [];
  if (saved > 0) parts.push(`deletes ${saved} saved wine${saved === 1 ? "" : "s"}`);
  if (dirty > 0) parts.push(`discards unsaved edits to ${dirty}`);
  const warning = `${parts.join(" and ")}.`;

  return (
    <div className="self-start pl-0 sm:pl-[6.5rem]">
      <ConfirmButton
        action={onRemove}
        label={label}
        confirmLabel={saved > 0 ? `Yes, delete ${saved} wine${saved === 1 ? "" : "s"}` : "Yes, remove it"}
        warning={warning.charAt(0).toUpperCase() + warning.slice(1)}
        className={linkClass}
        confirmClassName="-mx-2 rounded px-2 py-2 text-xs font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
      />
    </div>
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

// The same three destinations as the picker at the top of the page, keyed by
// the status each one writes rather than by scan intent, and sharing that
// picker's icons and accents.
const DESTINATIONS = [
  // Sorted newest-first, so finishing a scan lands on the wines just added
  // rather than on whatever happens to sort first by producer.
  { value: "inventory", label: "Cellar", path: "/inventory?sort=acquired", Icon: CellarIcon, accent: INTENT_LOOK.cellar.accent },
  { value: "wishlist", label: "Wishlist", path: "/wishlist", Icon: WishlistIcon, accent: INTENT_LOOK.wishlist.accent },
  { value: "consumed", label: "Tasted", path: "/consumed", Icon: TastingHistoryIcon, accent: INTENT_LOOK.tasting.accent },
];

function destinationFor(status) {
  return DESTINATIONS.find((d) => d.value === status);
}

// One decision should look like one decision wherever it is made. This
// control picks the same destination as the 44px picker above it, and was
// three browser-default radios about 20px tall - the smallest targets on a
// screen meant to be thumbed one-handed while the other hand holds a bottle.
function DestinationPicker({ name, legend, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm text-zinc-500">{legend}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {DESTINATIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1.5 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-900 dark:has-[:focus-visible]:outline-zinc-100 ${
                selected
                  ? `border-transparent font-medium ${option.accent}`
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <option.Icon className="h-4 w-4 shrink-0" />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ScanPanel({ initialIntent = DEFAULT_SCAN_INTENT }) {
  const fileInputRef = useRef(null);
  const [intent, setIntent] = useState(initialIntent);
  const [photos, setPhotos] = useState([]);
  // Survives clearing the batch, so the empty page can still say where the
  // wines went rather than looking like nothing happened.
  const [finished, setFinished] = useState(null);
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

  function markDirty(photoId, localId) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id !== photoId
          ? p
          : {
              ...p,
              entries: p.entries.map((e) =>
                e.localId === localId && !e.dirty ? { ...e, dirty: true } : e
              ),
            }
      )
    );
  }

  // Clears the unsaved marker and shows a confirmation that fades, rather
  // than one that sits there forever and stops meaning anything. Takes the
  // saved row back from the action so the card's heading shows what was
  // just saved rather than what the photo originally read.
  function confirmSaved(photoId, localId, bottle) {
    if (bottle) updateEntryBottle(photoId, localId, bottle);
    updateEntry(photoId, localId, { dirty: false, justSaved: true });
    setTimeout(() => updateEntry(photoId, localId, { justSaved: false }), 4000);
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
  // The radio moves first so the tap feels immediate, then goes back if the
  // write didn't land. Before this, setBottleStatus returned nothing whether
  // it worked or not, so a failed move left the card saying Wishlist while
  // the database still said Cellar - and nothing on screen disagreed.
  async function changeDestination(photo, entry, value) {
    const previous = entry.bottle.status;
    if (previous === value) return;

    updateEntryBottle(photo.id, entry.localId, { status: value });
    updateEntry(photo.id, entry.localId, { statusError: null });

    const result = await setBottleStatus(entry.bottle.id, value);
    if (result?.error) {
      updateEntryBottle(photo.id, entry.localId, { status: previous });
      updateEntry(photo.id, entry.localId, { statusError: result.error });
    }
  }

  // A scan card is a full editor now, so a wine Claude wasn't sure about can
  // be corrected right here - but updateBottle deliberately leaves
  // needsResearch alone (a plain edit shouldn't silently answer a research
  // question), and nothing on this card could say "I checked, it's fine". So
  // a corrected wine sat in /research forever waiting on a web lookup that
  // didn't know a human had already fixed it. Deliberately a button rather
  // than a side effect of saving: one field corrected without reading the
  // rest shouldn't resolve the whole question by accident.
  async function clearResearchFlag(photo, entry) {
    updateEntry(photo.id, entry.localId, { flagError: null });
    const result = await dismissResearch(entry.bottle.id);
    if (result?.error) {
      updateEntry(photo.id, entry.localId, { flagError: result.error });
      return;
    }
    updateEntryBottle(photo.id, entry.localId, { needsResearch: false });
  }

  // The other half of the flag. "Looks right" answers the question one way;
  // this answers it the other, without making you find the wine again on its
  // own page to do it. It runs a real web search and files a proposal - the
  // same one /research and the bottle page review - so the flag stays until
  // that proposal is accepted or dismissed, which is the point: research
  // proposes, you confirm.
  //
  // Safe to leave: researchBottle saves its proposal as the last thing it
  // does, server-side, so the answer is durable whether or not this page is
  // still listening when it finishes.
  async function researchEntry(photo, entry) {
    updateEntry(photo.id, entry.localId, {
      researching: true,
      flagError: null,
      researchResult: null,
    });
    const result = await researchBottle(entry.bottle.id);
    if (result?.error) {
      updateEntry(photo.id, entry.localId, {
        researching: false,
        flagError: result.error,
      });
      return;
    }
    updateEntry(photo.id, entry.localId, {
      researching: false,
      researchResult: { changed: result?.data?.changed ?? 0 },
    });
  }

  async function handleRemove(photo, entry) {
    if (entry.kind === "saved") {
      updateEntry(photo.id, entry.localId, { actionError: null });
      const result = await removeScannedBottle(entry.bottle.id);
      // The card goes only once the row has: dropping it on a failed delete
      // would leave a bottle in the cellar that nothing on screen mentions,
      // which is the same bug the whole-photo remove had.
      if (result?.error) {
        updateEntry(photo.id, entry.localId, { actionError: result.error });
        return;
      }
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
      // Kept per photo, not read from state at retry time: changing the
      // picker steers the next batch, so a re-read of this photo has to
      // use the destination it was chosen for, not whatever is selected
      // by the time you notice it failed.
      intent: intent,
      status: "loading",
      error: null,
      entries: [],
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    setFinished(null);
    event.target.value = "";

    // Captured now rather than read inside the worker: changing the picker
    // while a batch runs should steer the next batch, not this one. Same
    // value each photo carries, for the same reason.
    const batchIntent = intent;
    await runWithConcurrency(newPhotos, 3, (photo) => processPhoto(photo, batchIntent));
  }

  // Clears the review workspace, not the cellar. Every saved wine stays
  // exactly where it is; what goes is client state and the object URLs behind
  // the previews. The counts are kept so the empty page can point at the
  // lists the batch landed in.
  function finishBatch() {
    const counts = {};
    for (const photo of photos) {
      for (const entry of photo.entries) {
        if (entry.kind !== "saved") continue;
        counts[entry.bottle.status] = (counts[entry.bottle.status] ?? 0) + 1;
      }
    }
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setFinished(Object.keys(counts).length > 0 ? counts : null);
  }

  // A photo that fails to read falls back to a blank manual card, which
  // treats every failure as permanent - but the common one is transient (a
  // rate limit, a timeout), and the file is still right here. Re-reading it
  // is a click rather than a hunt through the camera roll for the same shot.
  async function retryPhoto(id) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    updatePhoto(id, { status: "loading", error: null, entries: [] });
    await processPhoto(photo, photo.intent ?? intent);
  }

  // Same rule as the per-wine Delete, applied to everything one photo
  // produced: a "saved" entry is already a row in the database, so dropping
  // its card has to delete that row too. Removing only the local state left
  // the batch looking tidied up while the bottles quietly stayed in the
  // cellar, with nothing on screen still pointing at them.
  async function removePhoto(id) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    const saved = photo.entries.filter((e) => e.kind === "saved");
    if (saved.length > 0) {
      updatePhoto(id, { removeError: null });
      const result = await removeScannedBottles(saved.map((e) => e.bottle.id));
      if (result?.error) {
        updatePhoto(id, { removeError: result.error });
        return;
      }
    }
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    URL.revokeObjectURL(photo.previewUrl);
  }

  // Typing into a card and then closing the tab used to lose the edit with
  // no sign it had happened. The browser's own prompt is the only thing that
  // can interrupt a tab close, and it only appears while there is genuinely
  // something to lose - `dirty` clears on a successful save.
  const hasUnsavedEdits = photos.some((p) => p.entries.some((e) => e.dirty));
  useEffect(() => {
    if (!hasUnsavedEdits) return;
    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedEdits]);

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
          {/* A cleared screen would otherwise look exactly like a screen
              nothing had happened on. This says what landed where, and links
              straight to it - the batch is gone from here, not from the app. */}
          {finished && (
            <div className="-mt-3 flex flex-col gap-1.5 rounded-lg border border-green-300 p-3 dark:border-green-900">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">
                &#10003; Batch finished &mdash; everything was saved.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {DESTINATIONS.filter((d) => finished[d.value]).map((d) => (
                  <Link
                    key={d.value}
                    href={d.path}
                    className="underline underline-offset-2"
                  >
                    {finished[d.value]} in {d.label} &rarr;
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className={`text-sm text-zinc-500 ${finished ? "" : "-mt-3"}`}>
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
                    // The radio itself is sr-only, so without has-[] the
                    // keyboard focus ring had nothing to draw on and moving
                    // through the three destinations was invisible.
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-900 dark:has-[:focus-visible]:outline-zinc-100 ${
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
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${look.accent}`}
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
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
                      selected
                        ? look.accent
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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
              className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:focus-visible:outline-zinc-100"
            >
              <ScanIcon className="h-4 w-4" />
              Add photos
            </button>
          </div>
        </div>
      )}

      <BatchProgress photos={photos} onDone={finishBatch} />

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
                  <div className="flex flex-col items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
                    <p>{photo.error}</p>
                    <button
                      type="button"
                      onClick={() => retryPhoto(photo.id)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:focus-visible:outline-zinc-100"
                    >
                      Read this photo again
                    </button>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Or add the bottle by hand below.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 pl-0 sm:pl-[6.5rem]">
              {photo.entries.map((entry) => (
                <div
                  key={entry.localId}
                  // A card you have finished with shrinks to its own name
                  // rather than disappearing: the batch summary still counts
                  // it, and a mis-tap costs one click to undo.
                  className={
                    entry.kind === "saved" && entry.done
                      ? "flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
                      : "flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  }
                >
                  {entry.kind === "saved" && entry.done ? (
                    <>
                      <p className="min-w-0 text-sm">
                        <span className="mr-1.5 text-green-700 dark:text-green-400">
                          &#10003;
                        </span>
                        <span className="font-medium">
                          {wineTitle(entry.bottle)}
                        </span>
                        <span className="text-zinc-500">
                          {" \u2014 "}
                          {destinationFor(entry.bottle.status)?.label}
                        </span>
                        {/* Collapsing shouldn't make an unsure wine look
                            settled - the flag travels with the line. */}
                        {entry.bottle.needsResearch && (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" \u00b7 needs a check"}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(photo.id, entry.localId, { done: false })
                        }
                        className="-mx-2 shrink-0 rounded px-2 py-2 text-xs text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100"
                      >
                        Reopen
                      </button>
                    </>
                  ) : entry.kind === "saved" ? (
                    <>
                      <EntryHeading wine={entry.bottle} />

                      {/* Pressing Update used to leave the card looking
                          exactly as it did before, so the only way to know
                          it had worked was to reload the page. */}
                      {entry.justSaved && (
                        <p
                          role="status"
                          className="text-sm font-medium text-green-700 dark:text-green-400"
                        >
                          &#10003; Changes saved
                        </p>
                      )}

                      {entry.bottle.needsResearch && (
                        <div className="flex flex-col items-start gap-2 rounded-lg border border-amber-300 p-2 dark:border-amber-900">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Not fully confident about this one &mdash; it&apos;s
                            already saved, but please double-check the fields
                            below.
                          </p>
                          {/* The flag asks a question, so both answers live
                              here. Once a proposal exists neither is offered
                              any more: clearing the flag would delete the
                              proposal the search just paid for, so the only
                              move left is to go and review it. */}
                          {entry.researchResult?.changed > 0 ? (
                            <Link
                              href={`/bottles/${entry.bottle.id}`}
                              className="min-h-11 rounded-lg border border-amber-300 px-3 py-2.5 text-xs font-medium text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-amber-900 dark:text-amber-300"
                            >
                              Review what the search found &rarr;
                            </Link>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => clearResearchFlag(photo, entry)}
                                disabled={entry.researching}
                                className="min-h-11 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-amber-900 dark:text-amber-300"
                              >
                                Looks right &mdash; clear the flag
                              </button>
                              <button
                                type="button"
                                onClick={() => researchEntry(photo, entry)}
                                disabled={entry.researching}
                                className="min-h-11 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:border-amber-900 dark:text-amber-300"
                              >
                                {entry.researching ? (
                                  <Spinner label="Searching the web…" />
                                ) : (
                                  "Not right \u2014 look it up"
                                )}
                              </button>
                            </div>
                          )}

                          {/* A search that changed nothing is an answer too,
                              and without saying so the button just looks
                              like it did nothing. */}
                          {entry.researchResult?.changed === 0 && (
                            <p
                              role="status"
                              className="text-xs text-amber-700 dark:text-amber-400"
                            >
                              The search didn&apos;t turn up anything to
                              change &mdash; what was read looks right.
                            </p>
                          )}

                          {entry.flagError && (
                            <p
                              role="alert"
                              className="text-xs text-red-600 dark:text-red-400"
                            >
                              {entry.flagError}
                            </p>
                          )}
                        </div>
                      )}

                      <DestinationPicker
                        name={`scan-status-${entry.localId}`}
                        legend="Saved to"
                        value={entry.bottle.status}
                        onChange={(value) => changeDestination(photo, entry, value)}
                      />

                      {entry.statusError && (
                        <p
                          role="alert"
                          className="text-xs text-red-600 dark:text-red-400"
                        >
                          {entry.statusError}
                        </p>
                      )}

                      {entry.bottle.scannedNote && (
                        <p className="text-xs text-zinc-500">
                          Your tasting note, read from the photo:{" "}
                          <span className="italic">
                            &ldquo;{entry.bottle.scannedNote}&rdquo;
                          </span>
                        </p>
                      )}

                      {/* Someone else's words about the wine - a shelf
                          talker, a back label. Worth showing, since the
                          scan can now fill this, but clamped: it is the
                          one field that routinely runs to paragraphs, and
                          the full text is a click away in the form. */}
                      {entry.bottle.criticNotes && (
                        <p className="line-clamp-3 text-xs text-zinc-500">
                          From the label or sheet:{" "}
                          <span className="italic">
                            &ldquo;{entry.bottle.criticNotes}&rdquo;
                          </span>
                        </p>
                      )}

                      {/* Closed by default. A scan of a shelf produces six
                          of these, and six open forms is several thousand
                          pixels of fields you almost never touch - the wine
                          is already saved and the fields it fills are the
                          ones the photo just read. The form is still in the
                          DOM, so nothing about saving changes; it is the
                          reading of the batch that gets its page back. */}
                      <details className="group">
                        <summary className="-mx-2 cursor-pointer list-none rounded px-2 py-2 text-sm text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100">
                          <span className="mr-1 inline-block no-underline group-open:hidden">
                            &#9656;
                          </span>
                          <span className="mr-1 hidden no-underline group-open:inline-block">
                            &#9662;
                          </span>
                          Edit details
                          {entry.dirty && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 no-underline dark:bg-amber-950 dark:text-amber-300">
                              unsaved
                            </span>
                          )}
                        </summary>
                        {/* Dirty tracking sits on the wrapper rather than
                            inside BottleForm: input and change both bubble,
                            so one pair of handlers covers every field
                            without the form itself having to know that this
                            page can throw its cards away. */}
                        <div
                          className="mt-3"
                          onInput={() => markDirty(photo.id, entry.localId)}
                          onChange={() => markDirty(photo.id, entry.localId)}
                        >
                          <BottleForm
                            action={updateBottle.bind(null, entry.bottle.id)}
                            defaultValues={entry.bottle}
                            submitLabel="Update"
                            idPrefix={`scan-entry-${entry.localId}`}
                            onResult={(result) => {
                              if (result?.success) {
                                confirmSaved(photo.id, entry.localId, result.bottle);
                              }
                            }}
                          />
                        </div>
                      </details>

                      {/* The only delete in the app that didn't ask, and
                          the hardest to hit - a 16px-tall text link. Both
                          now match the whole-photo remove below it. */}
                      {entry.actionError && (
                        <p
                          role="alert"
                          className="text-xs text-red-600 dark:text-red-400"
                        >
                          {entry.actionError}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Hidden while the card is dirty: collapsing then
                            would tuck unsaved edits out of sight, which is
                            the thing the unsaved badge exists to prevent. */}
                        {!entry.dirty && (
                          <button
                            type="button"
                            onClick={() =>
                              updateEntry(photo.id, entry.localId, { done: true })
                            }
                            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:focus-visible:outline-zinc-100"
                          >
                            Done
                          </button>
                        )}
                        <ConfirmButton
                          action={() => handleRemove(photo, entry)}
                          label="Delete this wine"
                          confirmLabel="Yes, delete it"
                          warning={`Deletes ${entry.bottle.producer || "this wine"} from your cellar.`}
                          className="-mx-2 rounded px-2 py-2 text-xs text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100"
                          confirmClassName="-mx-2 rounded px-2 py-2 text-xs font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
                        />
                      </div>
                    </>
                  ) : entry.status === "saved" ? (
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Saved
                    </p>
                  ) : (
                    <>
                      {(entry.extracted.producer || entry.extracted.bottling) && (
                        <EntryHeading wine={entry.extracted} />
                      )}

                      {entry.saveFailed && (
                        <p className="rounded-lg border border-red-300 p-2 text-xs text-red-700 dark:border-red-900 dark:text-red-400">
                          This wine was read from the photo, but saving it
                          failed. Nothing has been stored yet &mdash; check the
                          fields and press Save bottle.
                        </p>
                      )}

                      {entry.extracted.confident === false && (
                        <p className="rounded-lg border border-amber-300 p-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-400">
                          Not fully confident about this one &mdash; please
                          double-check the fields below.
                        </p>
                      )}

                      <DestinationPicker
                        name={`scan-status-${entry.localId}`}
                        legend="Save to"
                        value={entry.saveStatus}
                        onChange={(value) =>
                          updateEntry(photo.id, entry.localId, { saveStatus: value })
                        }
                      />

                      {/* Same dirty tracking as a saved card. A draft has
                          more to lose, not less: nothing here exists
                          anywhere yet. */}
                      <div
                        onInput={() => markDirty(photo.id, entry.localId)}
                        onChange={() => markDirty(photo.id, entry.localId)}
                      >
                        <BottleForm
                          action={createBottleWithNote.bind(null, entry.saveStatus)}
                          defaultValues={entry.extracted}
                          submitLabel="Save bottle"
                          includeTastingNote
                          idPrefix={`scan-entry-${entry.localId}`}
                          onResult={(result) => {
                            if (result.success) {
                              updateEntry(photo.id, entry.localId, {
                                status: "saved",
                                dirty: false,
                              });
                            }
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(photo, entry)}
                        className="-mx-2 self-start rounded px-2 py-2 text-xs text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100"
                      >
                        Discard this card
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {photo.status !== "loading" && (
              <>
                {photo.removeError && (
                  <p
                    role="alert"
                    className="pl-0 text-xs text-red-600 sm:pl-[6.5rem] dark:text-red-400"
                  >
                    {photo.removeError}
                  </p>
                )}
                <RemovePhotoButton photo={photo} onRemove={() => removePhoto(photo.id)} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
