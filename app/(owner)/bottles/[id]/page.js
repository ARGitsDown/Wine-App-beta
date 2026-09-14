import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRegionOptions } from "@/lib/bottles";
import {
  updateBottle,
  deleteBottle,
  setBottleStatus,
  finishOneBottle,
  addTastingNote,
  deleteBottlePhoto,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import ResearchPanel from "@/app/components/ResearchPanel";
import AddPhotoPanel from "@/app/components/AddPhotoPanel";
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

export default async function BottleDetailPage({ params, searchParams }) {
  const { id } = await params;
  const { pairedWith, tastingFlight } = await searchParams;
  const bottleId = Number(id);

  // Both together: the region list doesn't depend on the bottle, so
  // awaiting it afterward just added a second round-trip to every view.
  const [bottle, regionOptions] = await Promise.all([
    Number.isInteger(bottleId)
      ? prisma.bottle.findUnique({
          where: { id: bottleId },
          include: {
            tastingNotes: { orderBy: { tastedAt: "desc" } },
            favorites: { include: { guest: true } },
            photos: { orderBy: { createdAt: "asc" } },
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
            </div>
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
              <form action={finishOneBottle.bind(null, bottle.id)}>
                <button className={buttonClass} type="submit">
                  {bottle.quantity > 1
                    ? `Drink one — ${bottle.quantity - 1} left`
                    : "Mark as finished"}
                </button>
              </form>
              {/* Still a way to retire the whole lot at once (gave the case
                  away, fixing a bad count) - the button above only ever
                  moves the last bottle to History. */}
              {bottle.quantity > 1 && (
                <form action={setBottleStatus.bind(null, bottle.id, "consumed")}>
                  <button className={secondaryButtonClass} type="submit">
                    Finish all {bottle.quantity}
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

      <ResearchPanel bottle={bottle} regionOptions={regionOptions} />

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
              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>
                  {new Date(tastingNote.tastedAt).toLocaleDateString()}
                </span>
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
                  : tastingFlight
                    ? `Tasted as part of: ${tastingFlight}\n\n`
                    : ""
              }
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
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
          <button type="submit" className={`self-start ${buttonClass}`}>
            Add tasting note
          </button>
        </form>
      </section>
    </div>
  );
}
