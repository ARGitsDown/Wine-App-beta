import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { flightName } from "@/lib/flights";
import NewFlightForm from "@/app/components/NewFlightForm";

export const dynamic = "force-dynamic";

export default async function FlightsPage() {
  const flights = await prisma.tastingFlight.findMany({
    include: { picks: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Tasting flights</h1>
        <p className="text-sm text-zinc-500">
          Themed flights - a queue to pull bottles from over time. Ask
          Suggest for one and hit &quot;Save this flight,&quot; or start one
          yourself and pick the bottles.
        </p>
      </div>

      {flights.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No flights yet. Ask{" "}
          <Link href="/suggest" className="underline underline-offset-2">
            Suggest
          </Link>{" "}
          for one, or build your own below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {flights.map((flight) => {
            const remaining = flight.picks.filter((p) => !p.consumed).length;
            return (
              <li
                key={flight.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                {/* The title, where there is one. A flight saved before
                    titles existed has only its summary, so that stays its
                    name rather than being replaced by a guess. */}
                <Link
                  href={`/flights/${flight.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {flightName(flight)}
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  {remaining} of {flight.picks.length} left to taste ·{" "}
                  {new Date(flight.createdAt).toLocaleDateString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer font-medium">
          Start a flight yourself
        </summary>
        <div className="mt-4">
          <NewFlightForm />
        </div>
      </details>
    </div>
  );
}
