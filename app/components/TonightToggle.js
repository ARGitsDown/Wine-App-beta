"use client";

import { useTransition } from "react";
import { markPairingForTonight, clearPairingForTonight } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

const buttonClass =
  "min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700";

// A plain form action gave every other Tasted-style button on the bottle
// page a Spinner and a real tap target years ago (BACKLOG #29); this one
// was still a bare 32px <form> button with no pending state at all. A
// client component rather than two plain forms for the same reason
// TastedControls is one: the toggle's own label has to flip the instant
// the tap resolves, not just whenever the page happens to revalidate.
export default function TonightToggle({ pairingId, plannedForTonight }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (plannedForTonight) {
        await clearPairingForTonight(pairingId);
      } else {
        await markPairingForTonight(pairingId);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={isPending} className={buttonClass}>
        {plannedForTonight ? "Done for tonight" : "Drink tonight"}
      </button>
      {isPending && <Spinner label="Saving…" />}
    </span>
  );
}
