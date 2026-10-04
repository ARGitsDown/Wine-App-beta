import Link from "next/link";
import { getBottles, getLocationOptions, getRegionOptions } from "@/lib/bottles";
import { db } from "@/lib/scoped-prisma";
import { currentDomaineId } from "@/lib/owner";
import { isAuthConfigured } from "@/lib/auth";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";
import ScanAndAddRow from "@/app/components/ScanAndAddRow";
import { flightName, isOpenFlight } from "@/lib/flights";

export const dynamic = "force-dynamic";

export default async function CellarPage({ searchParams }) {
  const filters = await searchParams;
  const domaineId = await currentDomaineId();
  const [bottles, regionOptions, locationOptions, missingWindowCount, allFlights] = await Promise.all([
    getBottles("inventory"),
    getRegionOptions(domaineId),
    getLocationOptions(),
    db.bottle.count({
      where: { status: "inventory", drinkFrom: null, drinkTo: null },
    }),
    db.tastingFlight.findMany({
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
          above the list earns its room - sharing the cellar is one small
          link in the heading row rather than two lines of prose about a
          feature used a few times a year. It used to copy an open /guest
          link; since that was retired (BACKLOG #51), sharing means inviting
          someone as a Guest, so it goes where invites are made, with Guest
          already chosen (the form otherwise starts unchosen) - and only
          once accounts are on, since until then nobody can be invited. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold">Cellar</h1>
        {isAuthConfigured() && (
          <Link href="/invites?access=guest" className="text-sm text-zinc-500 underline underline-offset-2">
            Invite a guest
          </Link>
        )}
      </div>

      {/* Scan and hand entry on one line (BACKLOG #26) - Scan is still the
          fast way in, the one you reach for standing in front of the rack,
          and stays the primary control; hand entry is the smaller text
          control beside it. The intent travels in the scan link, so the
          scanner opens pointed at the cellar rather than needing to be
          corrected. */}
      <ScanAndAddRow scanHref="/scan?intent=cellar">
        <BottleForm
          action={createBottle.bind(null, "inventory")}
          regionOptions={regionOptions}
          showLotFields
          locationOptions={locationOptions}
        />
      </ScanAndAddRow>

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
        overview
        showAcquired
      />
    </div>
  );
}
