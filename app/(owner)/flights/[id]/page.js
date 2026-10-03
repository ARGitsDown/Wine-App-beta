import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { completeTastingFlight, deleteTastingFlight } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import FlightBottlePicker from "@/app/components/FlightBottlePicker";
import FlightPicksList from "@/app/components/FlightPicksList";
import BackButton from "@/app/components/BackButton";
import FlightTitle from "@/app/components/FlightTitle";

export const dynamic = "force-dynamic";

const neutralButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";
const neutralConfirmClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

export default async function FlightDetailPage({ params }) {
  const { id } = await params;
  const flightId = Number(id);

  // Reached by a bare id in the URL, so a foreign id has to read exactly
  // like a deleted flight - notFound() below - rather than rendering
  // someone else's flight.
  const flight = Number.isInteger(flightId)
    ? await db.tastingFlight.findUnique({
        where: { id: flightId },
        include: { picks: { include: { bottle: true }, orderBy: { order: "asc" } } },
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/flights" />
      <div className="flex flex-wrap items-start justify-between gap-3">
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
          <p className="text-sm text-zinc-500">
            Saved {new Date(flight.createdAt).toLocaleDateString()}
          </p>
        </div>
        {/* Two different acts, so two different words. A flight whose every
            wine has been tasted is finished: each wine is already logged, so
            what is left to do is put the flight away, and a red "Delete" on a
            flight that went well read as destroying something. One with wines
            still to pour is being thrown away, which is what Delete says. */}
        {allTasted ? (
          <ConfirmButton
            action={completeTastingFlight.bind(null, flight.id)}
            label="Complete flight"
            confirmLabel="Yes, complete it"
            tone="neutral"
            warning={`All ${flight.picks.length} wine${
              flight.picks.length === 1 ? " is" : "s are"
            } tasted and logged, with their notes. This clears the flight from your list.`}
            className={neutralButtonClass}
            confirmClassName={neutralConfirmClass}
          />
        ) : (
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
        )}
      </div>

      <FlightPicksList flightId={flight.id} picks={flight.picks} />

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
    </div>
  );
}
