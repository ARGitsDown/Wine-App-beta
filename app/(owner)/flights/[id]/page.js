import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteTastingFlight } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import FlightBottlePicker from "@/app/components/FlightBottlePicker";
import FlightPicksList from "@/app/components/FlightPicksList";
import BackButton from "@/app/components/BackButton";
import FlightTitle from "@/app/components/FlightTitle";

export const dynamic = "force-dynamic";

const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

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

  // Cellar only, matching what Suggest saves: a flight is a queue of
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

      <FlightPicksList flightId={flight.id} picks={flight.picks} />

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
