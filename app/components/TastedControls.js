"use client";

import { useTransition } from "react";
import { markOneTasted, setBottleStatus, undoOneTasted } from "@/app/actions";
import Spinner from "@/app/components/Spinner";
import BoughtIt from "@/app/components/BoughtIt";
import { useUndo } from "@/app/components/UndoToast";

const buttonClass =
  "min-h-11 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

// The Tasted buttons and their own Undo, as one client component rather
// than plain <form> actions - Undo needs to survive exactly the moment it
// exists for. Tasting the last bottle (or "Tasted all") moves `status`
// away from "inventory", and a component gated on that status - the old
// markup was - would unmount right along with it, taking a plain
// useState undo flag with it before the tap could ever show it. The
// bottle page renders this unconditionally (regardless of status), so the
// component instance - and `justActed` - survives that status flip; only
// the buttons shown inside it change.
//
// "Bought it" moved in here too (BACKLOG #29 polish note) - it used to be
// a separate plain `<form>` on the page itself, the one status-change
// button on this page with no pending state at all, since every other one
// already lived in this component and got it for free from `isPending`.
export default function TastedControls({
  bottleId,
  status,
  quantity,
  // The wine's name, for the Undo bar ("Tasted one · Rochioli 2019"), and the
  // price it already carries, which Bought it offers back rather than blank.
  name = null,
  priceCents = null,
  priceCurrency = null,
}) {
  const [isPending, startTransition] = useTransition();
  const showUndo = useUndo();
  const suffix = name ? ` \u00b7 ${name}` : "";

  // The Undo lives in the shared bar, not in this component: tasting the last
  // bottle (or "Tasted all") moves the wine to History and the list this sits
  // in re-renders without it, which is the moment an inline Undo would vanish.
  async function undoTasted() {
    return undoOneTasted(bottleId);
  }

  function tasteOne() {
    startTransition(async () => {
      await markOneTasted(bottleId);
      showUndo(`Tasted one${suffix}`, undoTasted);
    });
  }

  function tasteAll() {
    startTransition(async () => {
      await setBottleStatus(bottleId, "consumed");
      showUndo(`Tasted all ${quantity}${suffix}`, undoTasted);
    });
  }

  if (status === "wishlist") {
    return (
      <BoughtIt
        bottleId={bottleId}
        quantity={quantity}
        name={name}
        priceCents={priceCents}
        priceCurrency={priceCurrency}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "inventory" && (
        <>
          <button
            type="button"
            onClick={tasteOne}
            disabled={isPending}
            className={buttonClass}
          >
            {quantity > 1 ? `Tasted one — ${quantity - 1} left` : "Tasted"}
          </button>
          {/* Still a way to clear the whole lot at once (drank them at a
              dinner, gave the case away, fixing a bad count) - the button
              above only ever moves the last bottle to History. "Tasted"
              rather than "finished" throughout: finished reads as "done
              with this task", which is what Research's buttons mean, and
              the two sat side by side on this page. */}
          {quantity > 1 && (
            <button
              type="button"
              onClick={tasteAll}
              disabled={isPending}
              className={secondaryButtonClass}
            >
              Tasted all {quantity}
            </button>
          )}
        </>
      )}
      {isPending && <Spinner label="Saving…" />}
    </div>
  );
}
