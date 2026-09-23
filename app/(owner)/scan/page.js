import ScanPanel from "@/app/components/ScanPanel";
import { normalizeScanIntent } from "@/lib/scan-intent";
import { db } from "@/lib/scoped-prisma";
import { flightName, isOpenFlight } from "@/lib/flights";

export const dynamic = "force-dynamic";

// A thin server page over the scanner, so ?intent= can be read the same way
// every other page in the app reads its state - awaited off searchParams.
// The alternative, useSearchParams() inside the scanner itself, would put a
// Suspense boundary around the whole thing to no benefit.
//
// Open flights are fetched unconditionally rather than only when intent is
// "flight", since the picker at the top of the page can be changed client
// side after this renders - the same reason the intent picker itself stays
// editable rather than being locked by ?intent=. It's one small indexed
// query either way.
export default async function ScanPage({ searchParams }) {
  const { intent } = await searchParams;
  const allFlights = await db.tastingFlight.findMany({
    select: { id: true, title: true, summary: true, picks: { select: { consumed: true } } },
    orderBy: { createdAt: "desc" },
  });
  const openFlights = allFlights
    .filter(isOpenFlight)
    .map((flight) => ({ id: flight.id, name: flightName(flight) }));

  return (
    <ScanPanel initialIntent={normalizeScanIntent(intent)} openFlights={openFlights} />
  );
}
