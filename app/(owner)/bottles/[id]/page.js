import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRegionOptions } from "@/lib/bottles";
import {
  updateBottle,
  deleteBottle,
  setBottleStatus,
  markOneTasted,
  addTastingNote,
  updateTastingNoteDate,
  updateEmptiedDate,
  updateAcquiredDate,
  deleteBottlePhoto,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import AddToFlight from "@/app/components/AddToFlight";
import { flightName as nameOfFlight, isOpenFlight } from "@/lib/flights";
import ResearchPanel from "@/app/components/ResearchPanel";
import AddPhotoPanel from "@/app/components/AddPhotoPanel";
import InlineDateEditor from "@/app/components/InlineDateEditor";
import EstimateWindowButton from "@/app/components/EstimateWindowButton";
import { todayInputValue } from "@/lib/tasting-date";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";

export const dynamic = "force-dynamic";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

// Deleting a bottle cascades to everything hanging off it. Naming what
// actually goes with it is the point of confirming at all - "are you sure?"
// on its own tells you nothing you didn't already know.
function describeDeleteLoss(bottle) {
  const count = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const attached = [
    bottle.tastingNotes.length && count(bottle.tastingNotes.length, "tasting note", "tasting notes"),
    bottle.photos.length && count(bottle.photos.length, "added photo", "added photos"),
    bottle.favorites.length && count(bottle.favorites.length, "guest favorite", "guest favorites"),
  ].filter(Boolean);

  if (attached.length === 0) return "Permanently delete this bottle?";
  const list =
    attached.length === 1
      ? attached[0]
      : `${attached.slice(0, -1).join(", ")} and ${attached.at(-1)}`;
  return `Also deletes ${list}. This can't be undone.`;
}
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

// `tastingFlight` arrives as a flight id, so the note prefill can render
// whichever of the flight's title/summary exists rather than whatever text
// happened to be current when the link was built. Links made before that -
// or anything bookmarked - carried the text itself, so a non-numeric value
// is still used as written. A numeric id that no longer resolves (the
// flight was deleted) simply prefills nothing.
async function flightNameFor(param) {
  const value = String(param ?? "").trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return value;

  const flight = await prisma.tastingFlight.findUnique({
    where: { id: Number(value) },
    select: { title: true, summary: true },
  });
  return flight ? nameOfFlight(flight) : null;
}

export default async function BottleDetailPage({ params, searchParams }) {
  const { id } = await params;
  const { pairedWith, tastingFlight } = await searchParams;
  const [flightName, allFlights] = await Promise.all([
    flightNameFor(tastingFlight),
    prisma.tastingFlight.findMany({
      select: { id: true, title: true, summary: true, picks: { select: { consumed: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const openFlights = allFlights
    .filter(isOpenFlight)
    .map((flight) => ({ id: flight.id, name: nameOfFlight(flight) }));
  const bottleId = Number(id);

  // Both together: the region list doesn't depend on the bottle, so
  // awaiting it afterward just added a second round-trip to every view.
  const [bottle, regionOptions] = await Promise.all([
    Number.isInteger(bottleId)
      ? prisma.bottle.findUnique({
          where: { id: bottleId },
          include: {
            tastingNotes: { orderBy: [{ tastedAt: "desc" }, { id: "desc" }] },
            favorites: { include: { guest: true } },
            photos: { orderBy: { createdAt: "asc" } },
            // A research pass that has run but not been accepted yet. Read
            // here rather than fetched by the panel so the review is part
            // of the page's first render, not a second round trip.
            researchProposal: true,
          },
        })
      : null,
    getRegionOptions(),
  ]);

  if (!bottle) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {bottle.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bottle.photoUrl}
              alt={`Label photo for ${bottle.producer}`}
              className="h-24 w-20 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold">
              {WINE_COLOR_SWATCH[bottle.wineColor] && (
                <span
                  className={`mr-2 inline-block h-3 w-3 rounded-full align-middle ${WINE_COLOR_SWATCH[bottle.wineColor]}`}
                  title={bottle.wineColor}
                />
              )}
              {bottle.producer}
              {bottle.vintage ? ` ${bottle.vintage}` : ""}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm capitalize text-zinc-500">{bottle.status}</p>
              {bottle.needsResearch && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  Needs research
                </span>
              )}
              {(bottle.drinkFrom || bottle.drinkTo) && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Drink {bottle.drinkFrom ?? "?"}–{bottle.drinkTo ?? "?"}
                  {(() => {
                    const year = new Date().getFullYear();
                    if (bottle.drinkFrom && year < bottle.drinkFrom) return " (too young)";
                    if (bottle.drinkTo && year > bottle.drinkTo) return " (past peak)";
                    return " (ready)";
                  })()}
                  {bottle.drinkWindowEstimated && (
                    <span className="italic text-zinc-400 dark:text-zinc-500"> · estimated</span>
                  )}
                </span>
              )}
              {/* Scanning and Research now always propose a window, so a
                  blank one means a bottle added by hand or a wine neither
                  could place. Not offered on a bottle already drunk - when
                  to open it is no longer a question. */}
              {!bottle.drinkFrom &&
                !bottle.drinkTo &&
                bottle.status !== "consumed" && (
                  <EstimateWindowButton bottleId={bottle.id} />
                )}
            </div>
            {/* A wishlist bottle isn't owned, so there's nothing to date.
                Everywhere else it can be true - including History, where
                "acquired 2019, emptied 2026" is the interesting pair. */}
            {bottle.status !== "wishlist" && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
                <span>Acquired</span>
                <InlineDateEditor
                  date={bottle.acquiredAt}
                  action={updateAcquiredDate.bind(null, bottle.id)}
                  name="acquiredAt"
                  emptyLabel="date unknown"
                  title="Set when this entered the cellar"
                  clearable
                />
              </div>
            )}
            {bottle.status === "consumed" && (
              // A div, not a p: the editor renders a <form> once open, and
              // a form can't legally nest inside a paragraph.
              <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
                <span>Emptied</span>
                <InlineDateEditor
                  date={bottle.emptiedAt}
                  action={updateEmptiedDate.bind(null, bottle.id)}
                  name="emptiedAt"
                  emptyLabel="date unknown"
                  title="Set when this was emptied"
                />
              </div>
            )}
            {bottle.favorites.length > 0 && (
              <p className="mt-1 text-sm text-zinc-500">
                ❤️ Favorited by {bottle.favorites.map((f) => f.guest.name).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {bottle.status === "wishlist" && (
            <form action={setBottleStatus.bind(null, bottle.id, "inventory")}>
              <button className={buttonClass} type="submit">
                Bought it → move to inventory
              </button>
            </form>
          )}
          {bottle.status === "inventory" && (
            <>
              <form action={markOneTasted.bind(null, bottle.id)}>
                <button className={buttonClass} type="submit">
                  {bottle.quantity > 1
                    ? `Tasted one — ${bottle.quantity - 1} left`
                    : "Tasted"}
                </button>
              </form>
              {/* Still a way to clear the whole lot at once (drank them at a
                  dinner, gave the case away, fixing a bad count) - the
                  button above only ever moves the last bottle to History.
                  "Tasted" rather than "finished" throughout: finished reads
                  as "done with this task", which is what Research's buttons
                  mean, and the two sat side by side on this page. */}
              {bottle.quantity > 1 && (
                <form action={setBottleStatus.bind(null, bottle.id, "consumed")}>
                  <button className={secondaryButtonClass} type="submit">
                    Tasted all {bottle.quantity}
                  </button>
                </form>
              )}
            </>
          )}
          <ConfirmButton
            action={deleteBottle.bind(null, bottle.id)}
            label="Delete"
            confirmLabel="Yes, delete"
            warning={describeDeleteLoss(bottle)}
            className={dangerButtonClass}
          />
        </div>
        {/* Cellar only, like the card control: a flight is a queue of
            bottles you can actually open. */}
        {bottle.status === "inventory" && (
          <AddToFlight bottleId={bottle.id} flights={openFlights} />
        )}
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Details</h2>
        <BottleForm
          action={updateBottle.bind(null, bottle.id)}
          defaultValues={bottle}
          submitLabel="Save changes"
          regionOptions={regionOptions}
          idPrefix="bottle-details"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Photos</h2>
        {bottle.photoUrl || bottle.photos.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {bottle.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bottle.photoUrl}
                alt={`Label photo for ${bottle.producer}`}
                className="h-28 w-24 rounded border border-zinc-200 object-cover dark:border-zinc-800"
              />
            )}
            {bottle.photos.map((photo) => (
              <div key={photo.id} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Additional photo for ${bottle.producer}`}
                  className="h-28 w-24 rounded border border-zinc-200 object-cover dark:border-zinc-800"
                />
                <ConfirmButton
                  action={deleteBottlePhoto.bind(null, photo.id)}
                  label="Remove"
                  confirmLabel="Remove photo"
                  className="text-xs text-zinc-500 underline underline-offset-2"
                  confirmClassName="text-xs font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No photos yet.</p>
        )}
        <AddPhotoPanel bottle={bottle} regionOptions={regionOptions} />
      </section>

      <ResearchPanel
        bottle={bottle}
        proposal={bottle.researchProposal}
        regionOptions={regionOptions}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Tasting notes</h2>

        {bottle.tastingNotes.length === 0 && (
          <p className="text-sm text-zinc-500">No tasting notes yet.</p>
        )}

        <ul className="flex flex-col gap-3">
          {bottle.tastingNotes.map((tastingNote) => (
            <li
              key={tastingNote.id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
                <InlineDateEditor
                  date={tastingNote.tastedAt}
                  action={updateTastingNoteDate.bind(null, tastingNote.id)}
                  name="tastedAt"
                />
                <span>
                  {tastingNote.rating !== null
                    ? `${tastingNote.rating} / 5 ★`
                    : "No rating"}
                </span>
              </div>
              <p className="mt-1">{tastingNote.note}</p>
            </li>
          ))}
        </ul>

        <form
          action={addTastingNote.bind(null, bottle.id)}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              name="note"
              required
              rows={3}
              defaultValue={
                pairedWith
                  ? `Paired with: ${pairedWith}\n\n`
                  : flightName
                    ? `Tasted as part of: ${flightName}\n\n`
                    : ""
              }
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex max-w-[8rem] flex-col gap-1 text-sm">
              Rating (1–5, optional)
              <input
                name="rating"
                type="number"
                min="1"
                max="5"
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tasted on
              {/* Defaults to today, so logging as you drink stays one tap -
                  but a bottle you opened last month no longer gets stamped
                  with the day you got round to writing it up. */}
              <input
                name="tastedAt"
                type="date"
                defaultValue={todayInputValue()}
                max={todayInputValue()}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
          <button type="submit" className={`self-start ${buttonClass}`}>
            Add tasting note
          </button>
        </form>
      </section>
    </div>
  );
}
