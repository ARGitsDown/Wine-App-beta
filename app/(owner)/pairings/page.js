import Link from "next/link";
import { db } from "@/lib/scoped-prisma";
import { pairingSummaryLine, tonightLabel } from "@/lib/pairings";
import TonightToggle from "@/app/components/TonightToggle";

export const dynamic = "force-dynamic";

// In both navs now - the phone tab bar got a Pairings tab in an earlier
// session, and NavLinks.js's desktop list was fixed to match (BACKLOG
// #29's polish note: it had drifted out of sync and never gained one).
// Suggest also links here directly, which is where you'd look anyway -
// you come back to a kept pairing to run it again.
export default async function PairingsPage() {
  const pairings = await db.savedPairing.findMany({
    include: {
      picks: {
        select: { dish: true, wineName: true },
        orderBy: { order: "asc" },
      },
    },
    // Tonight's pairing(s) first, regardless of when they were kept -
    // that's the one thing on this list actually worth doing something
    // about today (BACKLOG #28/#39). Newest-first within each group,
    // same as before.
    orderBy: [{ plannedForTonight: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Kept pairings</h1>
        <p className="text-sm text-zinc-500">
          A dish and its wine, or a whole menu and its wines — the ones you
          decided were worth writing down.
        </p>
      </div>

      {pairings.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing kept yet. Ask{" "}
          <Link href="/suggest" className="underline underline-offset-2">
            Suggest
          </Link>{" "}
          what to open with dinner, and keep the answer if you like it.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pairings.map((pairing) => (
            <li
              key={pairing.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/pairings/${pairing.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {pairing.title}
                </Link>
                {/* Teal, matching the Pairings card's own accent on home -
                    amber was already "needs a check" (Needs research,
                    unsaved) and Wishlist elsewhere in the app, so the same
                    color meant two unrelated things on this one screen
                    (a UX review, 2026-09-27). */}
                {tonightLabel(pairing) && (
                  <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs text-teal-800 dark:bg-teal-950 dark:text-teal-400">
                    {tonightLabel(pairing)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {pairingSummaryLine(pairing)}
              </p>
              {/* The request, not the model's summary: what you asked for
                  is what you will recognize a month later. */}
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {pairing.request}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                  Kept {new Date(pairing.createdAt).toLocaleDateString()}
                </p>
                {/* On the row itself, not just the detail page - clearing
                    a stale "Planned ... - done?" shouldn't require opening
                    the pairing first (a UX review, 2026-09-27). */}
                <TonightToggle
                  pairingId={pairing.id}
                  plannedForTonight={pairing.plannedForTonight}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
