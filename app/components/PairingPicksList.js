import { BOTTLE_STATUS } from "@/lib/bottle-status";
import Link from "next/link";
import PairingDecision from "@/app/components/PairingDecision";
import PairingTasted from "@/app/components/PairingTasted";
import { groupPicksByDish, pickGone, pickNotOwned } from "@/lib/pairings";

// A pairing's wines, grouped under the dish or course each is for, so a
// menu's alternatives for the lamb sit together and the dish is said once
// instead of on every wine. One card per wine: its name (a link to the
// bottle when there is one), the reason it was suggested - shown in full,
// not behind a tap, because it is what the choice below is made on - and
// the Drink / Hold choice. A wine on hold reads quieter and says "On hold";
// one to drink has a Tasted-coloured edge. Neither is dimmed with opacity,
// which took the reason text under readable contrast (it measured 2.9:1);
// the quieter colours below all stay above 4.5:1 - and the name keeps the
// page's text colour either way, so blue is never both "Drink" and "link".
//
// Not the client component it was: with the reason always visible there is
// no expand state left to hold, and the one interactive part is
// PairingDecision.
export default function PairingPicksList({ picks, pairingTitle = null }) {
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
            const gone = pickGone(pick);
            const drank = Boolean(pick.drankAt);
            const drinking = pick.decision === "drink";
            const noteHref = pick.bottle
              ? `/bottles/${pick.bottle.id}?pairedWith=${encodeURIComponent(pick.dish || pairingTitle || "")}`
              : null;
            return (
              <div
                key={pick.id}
                className={`flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 ${
                  (drinking && !gone) || drank ? "border-l-4 border-l-sky-500 dark:border-l-sky-500" : ""
                }`}
              >
                <div>
                  {pick.bottle ? (
                    <Link
                      href={`/bottles/${pick.bottle.id}`}
                      className={`-my-2 block py-2 font-medium underline underline-offset-2 ${
                        held ? "text-zinc-600 dark:text-zinc-400" : ""
                      }`}
                    >
                      {pick.wineLabel}
                    </Link>
                  ) : (
                    <span className={`block font-medium ${held ? "text-zinc-600 dark:text-zinc-400" : ""}`}>
                      {pick.wineLabel}
                    </span>
                  )}
                  {/* Three states, and the label is the same in all of them
                      because it is a snapshot of how the wine read when this
                      was kept. What differs is whether there is still a
                      bottle to click through to, and why not. */}
                  {/* The same pill whether or not the wine has since been put
                      on the wishlist: it says what is true of the wine (not
                      in the cellar), and the status line above the tiles
                      carries the wishlist part, so nothing here moves when a
                      choice is made. */}
                  {notOwned ? (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                      Not in cellar
                    </span>
                  ) : (
                    gone && (
                      <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                        {pick.bottle?.status === BOTTLE_STATUS.CONSUMED ? "Already tasted" : "No longer in your cellar"}
                        {pick.decision ? ` \u00b7 you had chosen ${pick.decision === "drink" ? "Drink" : "Hold"}` : ""}
                      </span>
                    )
                  )}
                  {pick.gap && (pick.gap.region || pick.gap.country) && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {[pick.gap.region, pick.gap.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {held && !gone && (
                    <span className="mt-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">On hold</span>
                  )}
                  <p
                    className={`mt-1 text-sm ${
                      held ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {pick.reason}
                  </p>
                </div>
                {/* Drunk: the tiles give way to "Tasted, N left, Undo". Not yet:
                    the choice, and for a wine chosen Drink that is in the
                    cellar, the two ways to say it was opened. A suggestion
                    with no wine behind it, or one still on the wishlist, has
                    no Tasted: it has to be bought first (the status line
                    above the tiles says so). */}
                {drank ? (
                  <PairingTasted
                    pickId={pick.id}
                    drank
                    left={pick.bottle?.status === BOTTLE_STATUS.INVENTORY ? pick.bottle.quantity : 0}
                    bottleHref={pick.bottle ? `/bottles/${pick.bottle.id}` : null}
                    noteHref={noteHref}
                  />
                ) : (
                  <>
                    {/* No tiles for a wine that is no longer in the cellar:
                        there is nothing to drink or hold, and offering Drink
                        planned an evening around a bottle that was gone. */}
                    {!gone && (
                      <PairingDecision
                        pickId={pick.id}
                        decision={pick.decision}
                        wineLabel={pick.wineLabel}
                        notOwned={notOwned}
                        wishlistBottleId={wishlisted ? pick.bottle.id : null}
                      />
                    )}
                    {drinking && pick.bottle && !notOwned && pick.bottle.status !== BOTTLE_STATUS.WISHLIST && (
                      <PairingTasted pickId={pick.id} drank={false} noteHref={noteHref} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
