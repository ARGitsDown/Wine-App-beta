import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { currentDomaineId } from "@/lib/owner";
import { getRegionOptions } from "@/lib/bottles";
import {
  updateBottle,
  deleteBottle,
  unmarkFlightPickConsumed,
  updateTastingNote,
  updateTastingNoteDate,
  updateEmptiedDate,
  updateAcquiredDate,
  deleteBottlePhoto,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import AddToFlight from "@/app/components/AddToFlight";
import BackButton from "@/app/components/BackButton";
import TastedControls from "@/app/components/TastedControls";
import TastingNoteForm from "@/app/components/TastingNoteForm";
import TastingNoteBody from "@/app/components/TastingNoteBody";
import ExpandableText from "@/app/components/ExpandableText";
import { flightName as nameOfFlight, isOpenFlight } from "@/lib/flights";
import ResearchPanel from "@/app/components/ResearchPanel";
import AddPhotoPanel from "@/app/components/AddPhotoPanel";
import StatusBadge from "@/app/components/StatusBadge";
import InlineDateEditor from "@/app/components/InlineDateEditor";
import EstimateWindowButton from "@/app/components/EstimateWindowButton";
import { todayInputValue } from "@/lib/tasting-date";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import { drinkWindowLabel } from "@/lib/drink-window";
import { wineDetail } from "@/lib/wine-origin";

export const dynamic = "force-dynamic";

// Where Back sends you when this tab has no history to go back to (a
// bottle opened from a fresh link). The list matching its own status,
// since that's the one place among the half-dozen this page is reached
// from that's always right.
const STATUS_FALLBACK_HREF = {
  inventory: "/inventory",
  wishlist: "/wishlist",
  consumed: "/consumed",
  // No list page of its own - the flights index is the closest thing a
  // flight-status bottle has to a home (see the Bottle.status comment in
  // prisma/schema.prisma).
  flight: "/flights",
};

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
  "min-h-11 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

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

  const flight = await db.tastingFlight.findUnique({
    where: { id: Number(value) },
    select: { title: true, summary: true },
  });
  return flight ? nameOfFlight(flight) : null;
}

export default async function BottleDetailPage({ params, searchParams }) {
  const { id } = await params;
  // `tastingFlight` (arriving to write a note about a flight wine) and `flight`
  // (any other link from a flight's page) both say which flight the person came
  // from; `flight` carries no note prefill.
  const { pairedWith, tastingFlight, flight: flightParam, note: noteParam } = await searchParams;
  const domaineId = await currentDomaineId();
  const [flightName, allFlights] = await Promise.all([
    flightNameFor(tastingFlight),
    db.tastingFlight.findMany({
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
  //
  // The bottle fetch going through db (rather than prisma) is not
  // optional here the way it might look elsewhere: this page is reached
  // by a bare id in the URL, so a foreign id has to read exactly like a
  // deleted one - notFound() below - rather than rendering someone else's
  // bottle.
  const [bottle, regionOptions] = await Promise.all([
    Number.isInteger(bottleId)
      ? db.bottle.findUnique({
          where: { id: bottleId },
          include: {
            tastingNotes: { orderBy: [{ tastedAt: "desc" }, { id: "desc" }] },
            favorites: { include: { guest: true } },
            photos: { orderBy: { createdAt: "asc" } },
            // A research pass that has run but not been accepted yet. Read
            // here rather than fetched by the panel so the review is part
            // of the page's first render, not a second round trip.
            researchProposal: true,
            // Only meaningful for a flight-status bottle - whether it's
            // already linked decides between showing "Add to a tasting"
            // (BACKLOG #38's recovery path, widened below) and just
            // naming where it already went (a UX review, 2026-09-27).
            flightPicks: { select: { flight: { select: { id: true, title: true, summary: true } } } },
          },
        })
      : null,
    getRegionOptions(domaineId),
  ]);

  if (!bottle) notFound();

  // Where they came from, when it was a flight that still exists. Gives the
  // page a Back that names it, and - for a wine that was just tasted there - a
  // line saying so, since the flight did the marking and this page otherwise
  // looks like any other visit (BACKLOG #61).
  const contextFlightId = [tastingFlight, flightParam]
    .map((value) => String(value ?? "").trim())
    .find((value) => /^\d+$/.test(value));
  const contextFlight = contextFlightId
    ? await db.tastingFlight.findUnique({
        where: { id: Number(contextFlightId) },
        select: {
          id: true,
          title: true,
          summary: true,
          picks: {
            where: { bottleId },
            select: { id: true, consumed: true, originFlightOnly: true },
          },
        },
      })
    : null;
  const fromFlight = contextFlight
    ? { id: contextFlight.id, name: nameOfFlight(contextFlight), pick: contextFlight.picks[0] ?? null }
    : null;
  const back = fromFlight
    ? { href: `/flights/${fromFlight.id}`, label: `Back to ${fromFlight.name}` }
    : null;
  const arrivedTasted = Boolean(tastingFlight && fromFlight?.pick?.consumed);
  // Came here to write a note (via "With note", or from a pairing): the form
  // goes first, under the arrival line, instead of below everything else.
  const noteOnTop = Boolean(tastingFlight || pairedWith);
  const noteDefault = pairedWith
    ? `Paired with: ${pairedWith}\n\n`
    : flightName
      ? `Tasted as part of: ${flightName}\n\n`
      : "";
  const heading = [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
  const facts = [
    wineDetail(bottle),
    [bottle.wineColor, bottle.abv != null ? `${bottle.abv}% ABV` : null].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join(" · ");
  // What the flight's tap did to the cellar, said plainly.
  const tastedWhere = fromFlight?.pick?.originFlightOnly
    ? "now in Tasting notes"
    : bottle.status === "consumed"
      ? "that was the last bottle"
      : `${bottle.quantity} left in your cellar`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
      <BackButton
        fallbackHref={back?.href ?? STATUS_FALLBACK_HREF[bottle.status] ?? "/inventory"}
        label={back?.label}
      />
      {arrivedTasted && (
        <div
          role="status"
          className="-mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-green-300 px-4 py-2 text-sm dark:border-green-900"
        >
          <span className="font-medium text-green-800 dark:text-green-400">
            &#10003; Tasted in {fromFlight.name}
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">&middot; {tastedWhere}</span>
          <form action={unmarkFlightPickConsumed.bind(null, fromFlight.pick.id)} className="ml-auto">
            <button
              type="submit"
              className="min-h-11 px-1 text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
            >
              Undo
            </button>
          </form>
        </div>
      )}
      {noteOnTop && (
        <TastingNoteForm
          bottleId={bottle.id}
          defaultNote={noteDefault}
          today={todayInputValue()}
          back={back}
          title="Your tasting note"
        />
      )}
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
              {heading}
            </h1>
            {facts && <p className="mt-1 text-sm text-zinc-500">{facts}</p>}
            {/* Source is otherwise only inside "Edit details"; a line of it
                here means where a wine came from is something you can see. */}
            {bottle.notes && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">Source:</span>{" "}
                {bottle.notes}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={bottle.status} />
              {bottle.needsResearch && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  Needs research
                </span>
              )}
              {drinkWindowLabel(bottle) && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {drinkWindowLabel(bottle)}
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
              {/* Here rather than on a line of its own: when a bottle was
                  bought is occasionally interesting and almost never the
                  reason you opened this page, so it belongs among the
                  other small facts about the wine, not under the name of
                  it. A wishlist bottle isn't owned, so there is nothing to
                  date - a flight-status bottle isn't either, for the same
                  reason (see acquiredAtForStatus). */}
              {bottle.status !== "wishlist" && bottle.status !== "flight" && (
                <div className="flex flex-wrap items-center gap-1 py-0.5 text-xs text-zinc-500">
                  Acquired
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
            </div>
            {/* Emptied and tasted are the same evening, so a drunk bottle
                with a note already shows that date on the note and does not
                need it again here. Without a note there is nowhere else for
                it to appear - or to be corrected - so it stays, under the
                name the owner uses for it. */}
            {bottle.status === "consumed" && bottle.tastingNotes.length === 0 && (
              // A div, not a p: the editor renders a <form> once open, and
              // a form can't legally nest inside a paragraph.
              <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
                <span>Tasted</span>
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
          {/* "Bought it" lives inside TastedControls now (BACKLOG #29
              polish note) - it was the one status-change button on this
              page still a plain, pending-state-free <form>. */}
          {/* Not shown straight after "With note": the flight has just done
              this, the line at the top says so, and a second "Tasted one"
              here would take another bottle off the count. */}
          {!arrivedTasted && (
            <TastedControls
              bottleId={bottle.id}
              status={bottle.status}
              quantity={bottle.quantity}
            />
          )}
        </div>
        {/* Cellar wines can always add another tasting. A flight-status
            bottle can too, and needs to more - it's the recovery path for
            exactly the stranded case BACKLOG #38 names, reachable from
            here since this page (Research, an old scan card, a direct
            link) is often the only way back to one. Restricted to
            "inventory" alone used to hide this control from the one
            status that most needed it (a UX review, 2026-09-27). Once
            it's actually linked, naming where beats offering to add it
            again. */}
        {bottle.status === "flight" && bottle.flightPicks.length > 0 ? (
          <p className="text-sm text-zinc-500">
            In:{" "}
            {bottle.flightPicks
              .map((pick) => (
                <Link
                  key={pick.flight.id}
                  href={`/flights/${pick.flight.id}`}
                  className="underline underline-offset-2"
                >
                  {nameOfFlight(pick.flight)}
                </Link>
              ))
              .reduce((prev, curr) => [prev, ", ", curr])}
          </p>
        ) : (
          (bottle.status === "inventory" || bottle.status === "flight") && (
            <AddToFlight bottleId={bottle.id} flights={openFlights} />
          )
        )}
      </div>

      {/* Reference reading, shown rather than kept inside the edit form below
          (where it could only be read by opening 14 fields). Plain text, not
          a card: the bordered boxes on this page are for things you fill in.
          Nothing at all until Research or a scan has written something. */}
      {bottle.criticNotes && (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium">Critic &amp; winemaker notes</h2>
          <ExpandableText text={bottle.criticNotes} className="text-sm text-zinc-700 dark:text-zinc-300" />
        </section>
      )}

      {/* Closed by default, matching the same fix Scan cards already got
          (BACKLOG #16 - "every card was a full 14-field form"): this page
          is reached from everywhere else in the app (Research, a flight
          pick, a pairing), so every one of those visits used to open
          straight onto all 14 fields before the thing you actually came
          for - a note, the drinking window, a quick status change, all of
          which are already visible above this section. A visual UX review
          (2026-09-27) caught this by actually rendering the page, not by
          reading the JSX: the form is exactly as functional read as a flat
          list of inputs, but looks nothing like it once it's several
          thousand pixels tall on a phone. */}
      <section className="border-y border-zinc-200 dark:border-zinc-800">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded px-1 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100">
            <span className="inline-block text-sm text-zinc-400 transition-transform group-open:rotate-90">
              &#9656;
            </span>
            Wine details
          </summary>
          <div className="pb-4 pt-2">
            <BottleForm
              action={updateBottle.bind(null, bottle.id)}
              defaultValues={bottle}
              submitLabel="Save changes"
              regionOptions={regionOptions}
              idPrefix="bottle-details"
            />
          </div>
        </details>
      </section>

      {/* Right beside Details rather than at the foot of the page, past
          Photos and Research - every kind of note about this wine (Your
          notes and Critic notes live inside Wine details above; dated tasting
          notes are here) reads as one place to look, not two. */}
      {(!noteOnTop || bottle.tastingNotes.length > 0) && (
        <section className="flex flex-col gap-4">
          {/* The new-note form carries this heading itself, with its Save
              button beside it. When the form is already on top of the page
              (arriving to write a note) the heading is just the list's. With
              nothing yet written there is no list to head, and no sentence
              saying so. */}
          {noteOnTop ? (
            <h2 className="font-medium">Tasting notes</h2>
          ) : (
            <TastingNoteForm bottleId={bottle.id} defaultNote={noteDefault} today={todayInputValue()} />
          )}

          {bottle.tastingNotes.length > 0 && (
            <ul className="flex flex-col gap-3">
              {bottle.tastingNotes.map((tastingNote) => {
                // Arriving from a flight row's "Note" pill (?note=id): this
                // note is the reason for the visit, so it is scrolled to by
                // its anchor, ringed, and opened ready to change.
                const target = String(tastingNote.id) === noteParam;
                return (
                  <li
                    key={tastingNote.id}
                    id={`note-${tastingNote.id}`}
                    className={`scroll-mt-20 rounded-lg border p-3 ${
                      target
                        ? "border-sky-500 ring-2 ring-sky-500/30"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <TastingNoteBody
                      note={tastingNote.note}
                      rating={tastingNote.rating}
                      action={updateTastingNote.bind(null, tastingNote.id)}
                      startEditing={target}
                    >
                      <InlineDateEditor
                        date={tastingNote.tastedAt}
                        action={updateTastingNoteDate.bind(null, tastingNote.id)}
                        name="tastedAt"
                      />
                    </TastingNoteBody>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* No box and no "No photos yet": the heading carries the Add button,
          and with nothing to show there is simply the heading and the
          button. The photos are the usual case (they arrive with the scan). */}
      <section className="flex flex-col gap-3">
        <AddPhotoPanel bottle={bottle} regionOptions={regionOptions}>
          {(bottle.photoUrl || bottle.photos.length > 0) && (
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
          )}
        </AddPhotoPanel>
      </section>

      <ResearchPanel
        bottle={bottle}
        proposal={bottle.researchProposal}
        regionOptions={regionOptions}
      />

      {/* At the foot, not beside Tasted at the top: deleting a wine is rare,
          and the first screen of a page usually opened for something harmless
          should not have a red button on it. */}
      <div className="flex flex-col items-start border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ConfirmButton
          action={deleteBottle.bind(null, bottle.id)}
          label="Delete this wine"
          confirmLabel="Yes, delete"
          warning={describeDeleteLoss(bottle)}
          className={dangerButtonClass}
        />
      </div>
    </div>
  );
}
