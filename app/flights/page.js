import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
          Themed flights saved from Suggest - a queue to pull bottles from
          over time. Get one by asking Suggest for a tasting flight and
          hitting &quot;Save this flight.&quot;
        </p>
      </div>

      {flights.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No saved flights yet. Try{" "}
          <Link href="/suggest" className="underline underline-offset-2">
            Suggest
          </Link>
          .
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
                <Link
                  href={`/flights/${flight.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {flight.summary}
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
    </div>
  );
}
