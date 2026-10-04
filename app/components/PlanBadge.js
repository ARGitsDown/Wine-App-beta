"use client";

import { useSyncExternalStore } from "react";
import { planLabel } from "@/lib/pairings";
import { localDayInputValue } from "@/lib/tasting-date";

// "Tonight", "Tomorrow", "Saturday", "Oct 11" or "Queued" for a pairing's
// planned day. Worked out in the browser against the reader's own date: the
// server runs on UTC, which is already tomorrow for an evening in the
// Americas, so a server-rendered "Tonight" would turn into "Queued" at
// dinner time. The server's own guess (`serverToday`) is what is rendered
// first, so there is no empty badge before the browser corrects it.
//
// Teal for tonight and a day still to come, grey for queued: amber is this
// app's "needs a check" colour and it is not that urgent.
const LOOK = {
  tonight: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400",
  upcoming:
    "border border-teal-300 text-teal-800 dark:border-teal-900 dark:text-teal-400",
  queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const subscribeToNothing = () => () => {};

export default function PlanBadge({ plannedFor, serverToday }) {
  // The server's day while rendering there (and while hydrating), then the
  // reader's own once in the browser. A store with nothing to subscribe to:
  // the clock is read, not watched.
  const today = useSyncExternalStore(subscribeToNothing, localDayInputValue, () => serverToday);

  const label = planLabel(plannedFor, today);
  if (!label) return null;
  return (
    <span
      title={`Planned for ${plannedFor}`}
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${LOOK[label.kind]}`}
    >
      {label.text}
    </span>
  );
}
