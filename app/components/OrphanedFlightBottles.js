"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addBottlesToFlight, saveTastingFlight } from "@/app/actions";
import FlightLinkPanel from "@/app/components/FlightLinkPanel";

// The recovery path BACKLOG #38 built lived only on an existing flight's
// own "Add a bottle" search - findable, but only if you already know it's
// there and already know the wines' names. Nothing on /flights itself, or
// anywhere else in the app, ever said these wines existed at all (a UX
// review, 2026-09-27: several ordinary Scan-page actions - the finished
// batch's own link, a second round of photos, the leave-page warning -
// could all silently strand one with no sign afterward). This is the
// missing "somewhere that says so": the same panel ScanPanel shows right
// after a batch finishes, reused here for whatever a *previous* batch left
// unresolved.
export default function OrphanedFlightBottles({ wines, openFlights }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function addTo(flightId) {
    setBusy(true);
    setError(null);
    const result = await addBottlesToFlight(
      flightId,
      wines.map((w) => w.id)
    );
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push(`/flights/${result.data.flightId}`);
  }

  async function startNew(title) {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the flight a theme name.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveTastingFlight({
      title: trimmed,
      summary: null,
      picks: wines.map((w) => ({ bottleId: w.id, reason: null })),
    });
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push(`/flights/${result.data.id}`);
  }

  return (
    <FlightLinkPanel
      wines={wines}
      openFlights={openFlights}
      busy={busy}
      error={error}
      onAddTo={addTo}
      onStartNew={startNew}
      heading={
        wines.length === 1
          ? "This wine is waiting for a flight"
          : `${wines.length} wines are waiting for a flight`
      }
    />
  );
}
