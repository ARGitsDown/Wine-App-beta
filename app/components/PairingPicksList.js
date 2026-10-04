import Link from "next/link";
import PairingDecision from "@/app/components/PairingDecision";
import { groupPicksByDish, pickNotOwned } from "@/lib/pairings";

// A pairing's wines, grouped under the dish or course each is for, so a
// menu's alternatives for the lamb sit together and the dish is said once
// instead of on every wine. One card per wine: its name (a link to the
// bottle when there is one), the reason it was suggested - shown in full,
// not behind a tap, because it is what the choice below is made on - and
// the Drink / Hold choice. A wine on hold is dimmed; one to drink wears
// the Tasted colour.
//
// Not the client component it was: with the reason always visible there is
// no expand state left to hold, and the one interactive part is
// PairingDecision.
export default function PairingPicksList({ picks, plannedForTonight = false }) {
  return (
    <div className="flex flex-col gap-6">
      {groupPicksByDish(picks).map((group) => (
        <section key={group.dish ?? "single"} className="flex flex-col gap-2">
          {group.dish && (
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {group.dish}
            </h2>
          )}
          {group.picks.map((pick) => {
            const notOwned = pickNotOwned(pick);
            const wishlisted = notOwned && Boolean(pick.bottle);
            const held = pick.decision === "hold";
            const drinking = pick.decision === "drink";
            return (
              <div
                key={pick.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className={held ? "opacity-60" : ""}>
                  {pick.bottle ? (
                    <Link
                      href={`/bottles/${pick.bottle.id}`}
                      className={`block font-medium underline underline-offset-2 ${
                        drinking ? "text-sky-700 dark:text-sky-400" : ""
                      }`}
                    >
                      {pick.wineLabel}
                    </Link>
                  ) : (
                    <span className={`block font-medium ${drinking ? "text-sky-700 dark:text-sky-400" : ""}`}>
                      {pick.wineLabel}
                    </span>
                  )}
                  {/* Three states, and the label is the same in all of them
                      because it is a snapshot of how the wine read when this
                      was kept. What differs is whether there is still a
                      bottle to click through to, and why not. */}
                  {notOwned ? (
                    wishlisted ? (
                      <Link
                        href={`/bottles/${pick.bottle.id}`}
                        className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                      >
                        On your wishlist &rarr;
                      </Link>
                    ) : (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                        Not in your cellar
                      </span>
                    )
                  ) : (
                    !pick.bottle && (
                      <span className="mt-1 block text-xs text-zinc-500">No longer in your cellar</span>
                    )
                  )}
                  {pick.gap && (pick.gap.region || pick.gap.country) && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {[pick.gap.region, pick.gap.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
                </div>
                <PairingDecision
                  pickId={pick.id}
                  decision={pick.decision}
                  wineLabel={pick.wineLabel}
                  wishlist={notOwned && !wishlisted}
                />
                {/* Only while the evening is actually tonight, and only for a
                    wine that is in the cellar and has a dish to name: the
                    ?pairedWith prefill is what the throwaway Suggest result
                    gives the same wine. A wine on hold is not being tasted. */}
                {plannedForTonight &&
                  !held &&
                  pick.dish &&
                  pick.bottle?.status === "inventory" && (
                    <Link
                      href={`/bottles/${pick.bottle.id}?pairedWith=${encodeURIComponent(pick.dish)}`}
                      className="text-sm text-zinc-500 underline underline-offset-2"
                    >
                      Add a tasting note →
                    </Link>
                  )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
