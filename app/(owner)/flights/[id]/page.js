import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  markFlightPickConsumed,
  deleteTastingFlight,
  removeFlightPick,
  moveFlightPick,
} from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import FlightBottlePicker from "@/app/components/FlightBottlePicker";
import { flightName } from "@/lib/flights";

export const dynamic = "force-dynamic";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";
const reorderButtonClass =
  "flex h-6 w-6 items-center justify-center rounded border border-zinc-300 leading-none disabled:opacity-30 dark:border-zinc-700";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

export default async function FlightDetailPage({ params }) {
  const { id } = await params;
  const flightId = Number(id);

  const flight = Number.isInteger(flightId)
    ? await prisma.tastingFlight.findUnique({
        where: { id: flightId },
        include: { picks: { include: { bottle: true }, orderBy: { order: "asc" } } },
      })
    : null;

  if (!flight) notFound();

  // Inventory only, matching what Suggest saves: a flight is a queue of
  // things you can actually open. Already-picked bottles are filtered out
  // here so the picker can't offer a duplicate the action would refuse.
  const picked = new Set(flight.picks.map((pick) => pick.bottleId));
  const candidates = (
    await prisma.bottle.findMany({
      where: { status: "inventory" },
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
      },
      orderBy: { producer: "asc" },
    })
  ).filter((bottle) => !picked.has(bottle.id));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{flightName(flight)}</h1>
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
        <ConfirmButton
          action={deleteTastingFlight.bind(null, flight.id)}
          label="Delete flight"
          confirmLabel="Yes, delete"
          warning={`Deletes this flight and its ${flight.picks.length} pick${
            flight.picks.length === 1 ? "" : "s"
          }. The bottles themselves stay in your cellar.`}
          className={dangerButtonClass}
        />
      </div>

      <ol className="flex flex-col gap-3">
        {flight.picks.map((pick, index) => (
          <li
            key={pick.id}
            className={`flex flex-col gap-2 rounded-lg border p-4 ${
              pick.consumed
                ? "border-zinc-200 opacity-60 dark:border-zinc-800"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/bottles/${pick.bottle.id}`}
                className="font-medium underline underline-offset-2"
              >
                {index + 1}. {bottleHeader(pick.bottle)}
                {pick.bottle.type ? ` — ${pick.bottle.type}` : ""}
              </Link>
              {pick.consumed && (
                <span className="shrink-0 text-sm font-medium text-green-700 dark:text-green-400">
                  ✓ Tasted
                </span>
              )}
            </div>
            {/* A pick added by hand has no argument attached to it - only
                a place in the running order. */}
            {pick.reason && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>Order:</span>
              <form action={moveFlightPick.bind(null, pick.id, "up")}>
                <button
                  type="submit"
                  disabled={index === 0}
                  aria-label={`Move ${bottleHeader(pick.bottle)} earlier`}
                  className={reorderButtonClass}
                >
                  ↑
                </button>
              </form>
              <form action={moveFlightPick.bind(null, pick.id, "down")}>
                <button
                  type="submit"
                  disabled={index === flight.picks.length - 1}
                  aria-label={`Move ${bottleHeader(pick.bottle)} later`}
                  className={reorderButtonClass}
                >
                  ↓
                </button>
              </form>
              <form action={removeFlightPick.bind(null, pick.id)}>
                <button type="submit" className="underline underline-offset-2">
                  Remove from flight
                </button>
              </form>
            </div>
            {!pick.consumed && (
              <div className="flex flex-wrap gap-2">
                <form action={markFlightPickConsumed.bind(null, pick.id)}>
                  <button type="submit" className={buttonClass}>
                    Mark as tasted
                  </button>
                </form>
                {/* The id, not the text: the note prefill then renders
                    whichever of title/summary this flight actually has,
                    instead of freezing a copy into the URL. */}
                <Link
                  href={`/bottles/${pick.bottle.id}?tastingFlight=${flight.id}`}
                  className="self-center text-sm text-zinc-500 underline underline-offset-2"
                >
                  Log a tasting note →
                </Link>
              </div>
            )}
          </li>
        ))}
      </ol>

      {flight.picks.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nothing in this flight yet. Add bottles below, in the order
          you&apos;d pour them.
        </p>
      )}

      {/* Open to begin with on an empty flight, since adding bottles is the
          only thing there is to do on one. */}
      <FlightBottlePicker
        flightId={flight.id}
        bottles={candidates}
        defaultOpen={flight.picks.length === 0}
      />
    </div>
  );
}
