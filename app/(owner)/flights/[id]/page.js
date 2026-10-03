import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { completeTastingFlight, deleteTastingFlight } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import FlightBottlePicker from "@/app/components/FlightBottlePicker";
import FlightPicksList from "@/app/components/FlightPicksList";
import BackButton from "@/app/components/BackButton";
import StatusBadge from "@/app/components/StatusBadge";
import FlightTitle from "@/app/components/FlightTitle";

export const dynamic = "force-dynamic";

const neutralButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";
const neutralConfirmClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

// Whether a tasted wine has a note from this tasting, and its rating. Notes
// are not linked to flights, so "from this tasting" is a date test: a note
// dated from the day before the flight was made onward. The day of slack is
// because a note's date is a calendar day anchored at noon UTC
// (lib/tasting-date.js) while the flight's own timestamp is exact, so an
// evening flight made in a western time zone is already "tomorrow" in UTC.
// Approximate on purpose: a wine tasted at an earlier tasting keeps no tag
// here, and one noted the day before the flight was made would carry it.
function noteInfoFor(flight, bottle) {
  const day = 24 * 60 * 60 * 1000;
  const startOfFlightDay = new Date(flight.createdAt);
  startOfFlightDay.setUTCHours(0, 0, 0, 0);
  const cutoff = startOfFlightDay.getTime() - day;
  const mine = bottle.tastingNotes
    .filter((note) => new Date(note.tastedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.tastedAt) - new Date(a.tastedAt) || b.id - a.id);
  if (mine.length === 0) return null;
  return { rating: mine.find((note) => note.rating != null)?.rating ?? null };
}

export default async function FlightDetailPage({ params }) {
  const { id } = await params;
  const flightId = Number(id);

  // Reached by a bare id in the URL, so a foreign id has to read exactly
  // like a deleted flight - notFound() below - rather than rendering
  // someone else's flight.
  const flight = Number.isInteger(flightId)
    ? await db.tastingFlight.findUnique({
        where: { id: flightId },
        include: {
          picks: {
            // The notes are read only to say, on a tasted wine, whether this
            // tasting produced one and how it was rated (see noteInfoFor).
            include: { bottle: { include: { tastingNotes: { select: { id: true, rating: true, tastedAt: true } } } } },
            orderBy: { order: "asc" },
          },
        },
      })
    : null;

  if (!flight) notFound();

  // Cellar bottles, matching what Suggest saves - a flight is normally a
  // queue of things you can actually open - plus flight-only bottles
  // (status "flight") that were saved from a scan but never got linked to
  // any flight, since that's currently the only recovery path for one:
  // the scan step that links them is required but not literally
  // unabortable (BACKLOG #37 - a closed tab mid-batch leaves the bottle
  // exactly here, findable but not yet in a flight). Already-picked
  // bottles are filtered out here so the picker can't offer a duplicate
  // the action would refuse.
  const picked = new Set(flight.picks.map((pick) => pick.bottleId));
  const candidates = (
    await db.bottle.findMany({
      where: { status: { in: ["inventory", "flight"] } },
      select: {
        id: true,
        producer: true,
        bottling: true,
        vintage: true,
        type: true,
        variety: true,
        region: true,
        country: true,
        wineColor: true,
        // Read so the picker can put a flight-only bottle first and
        // badge it - it's the one this search exists to help you find
        // again (a UX review, 2026-09-27).
        status: true,
      },
      orderBy: { producer: "asc" },
    })
  ).filter((bottle) => !picked.has(bottle.id));

  // How many of this flight's own picks were never in the cellar to begin
  // with - the delete confirm below has to say so, since "the bottles stay
  // in your cellar" is false for exactly these (a UX review, 2026-09-27:
  // the same misleading claim FlightPicksList's own "Remove from flight"
  // made, fixed there in BACKLOG #41).
  const originFlightOnlyCount = flight.picks.filter((pick) => pick.originFlightOnly).length;

  // Finished: there is at least one wine and every one has been tasted. An
  // empty flight is not finished, it is just unstarted (and Delete is the
  // right word for putting one of those away).
  const allTasted = flight.picks.length > 0 && flight.picks.every((pick) => pick.consumed);
  // What "Complete flight" would still have to mark tasted, split the way the
  // confirm has to say it: a cellar wine comes off its count, a flight-only
  // wine moves to Tasting notes (markFlightPickConsumed).
  const untasted = flight.picks.filter((pick) => !pick.consumed);
  const untastedFlightOnly = untasted.filter((pick) => pick.originFlightOnly).length;
  const untastedCellar = untasted.length - untastedFlightOnly;

  const tastedCount = flight.picks.length - untasted.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {/* Three short rows, so the wines start as high as they can: Back (with
          what kind of page this is, opposite it), the flight's name, then the
          one thing to do with the flight as a whole beside how far along it
          is. The purple Flight pill used to be on every wine, which this page
          needs said once, not per row. */}
      <div className="flex items-center justify-between gap-3">
        <BackButton fallbackHref="/flights" />
        <StatusBadge status="flight" />
      </div>

      <div className="flex flex-col gap-1">
        <FlightTitle flight={flight} />
        {/* This page is the expansion - you clicked through to it, so the
            theme is spelled out here rather than hidden behind a second
            disclosure. Skipped when the summary IS the heading above, and
            when a hand-built flight simply doesn't have one. */}
        {flight.title && flight.summary && (
          <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            {flight.summary}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* The way to finish sits up here and works whether or not each wine
            was ticked off one by one: with wines still untasted it marks them
            all tasted and then clears the flight, so nobody has to tap through
            a dozen rows to be done. An empty flight has nothing to complete,
            so it gets Delete here instead; throwing away a flight that was
            never tasted is Delete's job, and for the rest it sits at the foot
            of the page. */}
        {flight.picks.length === 0 ? (
          <ConfirmButton
            action={deleteTastingFlight.bind(null, flight.id)}
            label="Delete flight"
            confirmLabel="Yes, delete"
            warning={
              originFlightOnlyCount > 0
                ? `Deletes this flight and its ${flight.picks.length} pick${
                    flight.picks.length === 1 ? "" : "s"
                  }. ${originFlightOnlyCount} of these wine${
                    originFlightOnlyCount === 1 ? " was" : "s were"
                  } only ever in this flight and will have nowhere else to appear.${
                    flight.picks.length > originFlightOnlyCount
                      ? " The rest stay in your cellar."
                      : ""
                  }`
                : `Deletes this flight and its ${flight.picks.length} pick${
                    flight.picks.length === 1 ? "" : "s"
                  }. The bottles themselves stay in your cellar.`
            }
            className={dangerButtonClass}
          />
        ) : (
          <ConfirmButton
            action={completeTastingFlight.bind(null, flight.id)}
            label="Complete flight"
            confirmLabel={allTasted ? "Yes, complete it" : "Yes, mark all tasted"}
            tone="neutral"
            warning={
              allTasted
                ? `All ${flight.picks.length} wine${
                    flight.picks.length === 1 ? " is" : "s are"
                  } tasted and logged, with their notes. This clears the flight from your list.`
                : `Marks the ${untasted.length} untasted wine${
                    untasted.length === 1 ? "" : "s"
                  } as tasted${
                    untastedCellar > 0
                      ? ` (${untastedCellar} from your cellar - one bottle each comes off its count${
                          untastedFlightOnly > 0 ? `; ${untastedFlightOnly} move to Tasting notes` : ""
                        })`
                      : untastedFlightOnly > 0
                        ? ` (they move to Tasting notes)`
                        : ""
                  }, then clears the flight. Add notes first if you want them.`
            }
            className={neutralButtonClass}
            confirmClassName={neutralConfirmClass}
          />
        )}
        <span className="text-sm text-zinc-500">
          {flight.picks.length > 0 && `${tastedCount} of ${flight.picks.length} tasted \u00b7 `}
          {flight.picks.length > 0 ? "" : "Saved "}
          {new Date(flight.createdAt).toLocaleDateString()}
        </span>
      </div>

      <FlightPicksList
        flightId={flight.id}
        picks={flight.picks.map((pick) => {
          const { tastingNotes, ...bottle } = pick.bottle;
          void tastingNotes;
          return { ...pick, bottle, noteInfo: pick.consumed ? noteInfoFor(flight, pick.bottle) : null };
        })}
      />

      {flight.picks.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nothing in this flight yet. Add bottles below, in the order
          you&apos;d pour them.
        </p>
      )}

      {/* Open to begin with on an empty flight, since adding bottles is the
          only thing there is to do on one. Beside it, the other way in:
          wines poured at an event were never in the cellar, so picking from
          it can't find them, while photographing the labels or the tasting
          sheet can - here, in this flight, rather than back out through Scan
          and a "which flight?" step afterward. */}
      <FlightBottlePicker
        flightId={flight.id}
        bottles={candidates}
        defaultOpen={flight.picks.length === 0}
        photoHref={`/flights/${flight.id}/scan`}
      />

      {/* Discarding a flight that was never tasted: the opposite of
          completing one, so it is apart from it and quieter. */}
      {flight.picks.length > 0 && (
        <div className="flex flex-col items-start gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <ConfirmButton
            action={deleteTastingFlight.bind(null, flight.id)}
            label="Delete flight"
            confirmLabel="Yes, delete"
            warning={
              originFlightOnlyCount > 0
                ? `Deletes this flight and its ${flight.picks.length} pick${
                    flight.picks.length === 1 ? "" : "s"
                  }. ${originFlightOnlyCount} of these wine${
                    originFlightOnlyCount === 1 ? " was" : "s were"
                  } only ever in this flight and will have nowhere else to appear.${
                    flight.picks.length > originFlightOnlyCount
                      ? " The rest stay in your cellar."
                      : ""
                  }`
                : `Deletes this flight and its ${flight.picks.length} pick${
                    flight.picks.length === 1 ? "" : "s"
                  }. The bottles themselves stay in your cellar.`
            }
            className={dangerButtonClass}
          />
        </div>
      )}
    </div>
  );
}
