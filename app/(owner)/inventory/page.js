import Link from "next/link";
import { getBottles, getRegionOptions } from "@/lib/bottles";
import { prisma } from "@/lib/prisma";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";
import GuestLinkButton from "@/app/components/GuestLinkButton";
import { flightName, isOpenFlight } from "@/lib/flights";
import { ScanIcon } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export default async function CellarPage({ searchParams }) {
  const filters = await searchParams;
  const [bottles, regionOptions, missingWindowCount, allFlights] = await Promise.all([
    getBottles("inventory"),
    getRegionOptions(),
    prisma.bottle.count({
      where: { status: "inventory", drinkFrom: null, drinkTo: null },
    }),
    prisma.tastingFlight.findMany({
      select: {
        id: true,
        title: true,
        summary: true,
        picks: { select: { consumed: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Only the flights still worth adding to, reduced to what the control
  // actually renders - a finished flight is a record, not a queue.
  const openFlights = allFlights
    .filter(isOpenFlight)
    .map((flight) => ({ id: flight.id, name: flightName(flight) }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {/* Browsing comes before adding here, which is the opposite of the
          Wishlist and deliberately so: a wishlist is added to constantly and
          browsed rarely, a cellar of hundreds is the reverse. Everything
          above the list earns its room - the guest link is a chip in the
          heading row rather than two lines of prose about a feature used a
          few times a year, and hand entry is a line rather than a box. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold">Cellar</h1>
        <span className="flex items-center gap-2 text-sm text-zinc-500">
          Guest link
          <GuestLinkButton />
        </span>
      </div>

      {/* Scanning stays a real button - it is the fast way in, and the one
          you reach for standing in front of the rack. The intent travels in
          the link, so the scanner opens pointed at the cellar rather than
          needing to be corrected. Hand entry sits under it as a line: still
          one tap, but no longer a boxed block competing with the wine. */}
      <div className="flex flex-col gap-2">
        <Link
          href="/scan?intent=cellar"
          className="flex items-center justify-center gap-2.5 rounded-lg border border-zinc-300 px-4 py-3 font-medium hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        >
          <ScanIcon className="h-5 w-5" />
          Scan a label or shelf
        </Link>

        <details className="group">
          <summary className="-mx-2 inline-flex cursor-pointer list-none items-center rounded px-2 py-2 text-sm text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100">
            <span className="mr-1 no-underline group-open:hidden">&#9656;</span>
            <span className="mr-1 hidden no-underline group-open:inline">
              &#9662;
            </span>
            Add a bottle by hand
          </summary>
          <div className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <BottleForm
              action={createBottle.bind(null, "inventory")}
              regionOptions={regionOptions}
            />
          </div>
        </details>
      </div>

      {/* Sits with the list rather than up by the heading: it is a prompt
          about the bottles already in the cellar, not a third way to put
          one in. */}
      {missingWindowCount > 0 && (
        <Link
          href="/estimate-windows"
          className="rounded-lg border border-amber-300 p-3 text-sm text-amber-800 hover:border-amber-400 dark:border-amber-900 dark:text-amber-400"
        >
          {missingWindowCount} bottle{missingWindowCount === 1 ? "" : "s"}{" "}
          missing a drinking window — estimate now →
        </Link>
      )}

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        emptyMessage="No bottles match. Clear your filters, or add a bottle above."
        flights={openFlights}
        showAcquired
      />
    </div>
  );
}
