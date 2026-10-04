import Link from "next/link";
import { db } from "@/lib/scoped-prisma";
import { orderPairings, pickNotOwned } from "@/lib/pairings";
import { toDateInputValue, todayInputValue } from "@/lib/tasting-date";
import { STATUS_LOOK } from "@/lib/status-look";
import PairingPlan from "@/app/components/PairingPlan";
import PairingProgress from "@/app/components/PairingProgress";
import PlanBadge from "@/app/components/PlanBadge";

export const dynamic = "force-dynamic";

// In both navs now - the phone tab bar got a Pairings tab in an earlier
// session, and NavLinks.js's desktop list was fixed to match (BACKLOG
// #29's polish note: it had drifted out of sync and never gained one).
// Suggest also links here directly, which is where you'd look anyway -
// you come back to a kept pairing to run it again.
export default async function PairingsPage() {
  const pairingsByDate = await db.savedPairing.findMany({
    include: {
      picks: {
        select: {
          id: true,
          dish: true,
          wineName: true,
          decision: true,
          gap: true,
          bottle: { select: { status: true } },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  // Planned pairings first, soonest first, regardless of when they were kept
  // - that's what is actually worth doing something about (BACKLOG #28/#39);
  // then ones whose day has passed ("Queued"); then the rest, newest first.
  const today = todayInputValue();
  const pairings = orderPairings(pairingsByDate, today);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Saved pairings</h1>
        <p className="text-sm text-zinc-500">Wines paired with a dish or menu</p>
      </div>

      {pairings.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing saved yet. Ask{" "}
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
              className="relative rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* The title link covers the whole row (the ::after), so the
                    row opens the pairing wherever it is tapped; the one thing
                    that sits above it is the plan button. */}
                <Link
                  href={`/pairings/${pairing.id}`}
                  className="font-medium underline underline-offset-2 after:absolute after:inset-0"
                >
                  {pairing.title}
                </Link>
                {pairing.plannedFor && (
                  <PlanBadge
                    plannedFor={toDateInputValue(pairing.plannedFor)}
                    serverToday={today}
                  />
                )}
              </div>
              {/* The request, not the model's summary: what you asked for is
                  what you will recognize a month later. */}
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {pairing.request}
              </p>
              {/* The wines, one to a line, with the choice made about each as
                  the app's own status pills: Drink in the Tasted look, Hold
                  in the Cellar look, a wine you do not own in the Wishlist
                  look. Undecided has no pill. */}
              <ul className="mt-2 flex flex-col gap-1">
                {pairing.picks.map((pick) => (
                  <li key={pick.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={pick.decision === "hold" ? "text-zinc-400 dark:text-zinc-500" : ""}>
                      {pick.wineName}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {pick.decision === "drink" && <Pill look={STATUS_LOOK.consumed} label="Drink" />}
                      {pick.decision === "hold" && <Pill look={STATUS_LOOK.inventory} label="Hold" />}
                      {pickNotOwned(pick) && (
                        <Pill
                          look={STATUS_LOOK.wishlist}
                          label={pick.bottle ? "On wishlist" : "Not in cellar"}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {/* How far along the choices are - the same count the
                    pairing's own page leads with - so a pairing nobody has
                    looked at reads differently from one half decided. */}
                <PairingProgress picks={pairing.picks} planned={Boolean(pairing.plannedFor)} />
                <span className="relative z-10">
                  <PairingPlan
                    pairingId={pairing.id}
                    plannedDay={pairing.plannedFor ? toDateInputValue(pairing.plannedFor) : null}
                    compact
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A small pill in one of the app's status looks (lib/status-look.js), the
// same one StatusBadge draws for a bottle, at the size a list line affords.
function Pill({ look, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${look.accent}`}
    >
      <look.Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
