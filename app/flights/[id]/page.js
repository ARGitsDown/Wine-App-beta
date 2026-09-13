import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { markFlightPickConsumed, deleteTastingFlight } from "@/app/actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{flight.summary}</h1>
          <p className="text-sm text-zinc-500">
            Saved {new Date(flight.createdAt).toLocaleDateString()}
          </p>
        </div>
        <form action={deleteTastingFlight.bind(null, flight.id)}>
          <button type="submit" className={dangerButtonClass}>
            Delete flight
          </button>
        </form>
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
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
            {!pick.consumed && (
              <div className="flex flex-wrap gap-2">
                <form action={markFlightPickConsumed.bind(null, pick.id)}>
                  <button type="submit" className={buttonClass}>
                    Mark as tasted
                  </button>
                </form>
                <Link
                  href={`/bottles/${pick.bottle.id}?tastingFlight=${encodeURIComponent(flight.summary)}`}
                  className="self-center text-sm text-zinc-500 underline underline-offset-2"
                >
                  Log a tasting note →
                </Link>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
