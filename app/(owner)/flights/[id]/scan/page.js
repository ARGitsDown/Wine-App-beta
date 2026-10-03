import { notFound } from "next/navigation";
import ScanPanel from "@/app/components/ScanPanel";
import AiLimitNotice from "@/app/components/AiLimitNotice";
import BackButton from "@/app/components/BackButton";
import { db } from "@/lib/scoped-prisma";
import { flightName } from "@/lib/flights";
import { FEATURE } from "@/lib/usage-features";

export const dynamic = "force-dynamic";

// The scanner, opened from inside one flight: every wine it reads goes
// straight into that flight, so the destination tiles, the per-card "Saved
// to" control and the "which flight?" step that follows an ordinary scan are
// all left out (ScanPanel's `flight` prop). It lives under the flight rather
// than at /scan?flight=... so the flight in play is part of the address a
// person is looking at, and a foreign or deleted id is just a 404 like any
// other flight page.
export default async function FlightScanPage({ params }) {
  const { id } = await params;
  const flightId = Number(id);

  const flight = Number.isInteger(flightId)
    ? await db.tastingFlight.findUnique({
        where: { id: flightId },
        select: { id: true, title: true, summary: true },
      })
    : null;
  if (!flight) notFound();

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-8">
        <BackButton fallbackHref={`/flights/${flight.id}`} label="Back to the flight" />
      </div>
      <AiLimitNotice feature={FEATURE.SCAN} />
      <ScanPanel flight={{ id: flight.id, name: flightName(flight) }} />
    </>
  );
}
