"use client";

import { useState, useTransition } from "react";
import { markOneTasted, setBottleStatus, undoOneTasted } from "@/app/actions";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

// The Tasted buttons and their own Undo, as one client component rather
// than plain <form> actions - Undo needs to survive exactly the moment it
// exists for. Tasting the last bottle (or "Tasted all") moves `status`
// away from "inventory", and a component gated on that status - the old
// markup was - would unmount right along with it, taking a plain
// useState undo flag with it before the tap could ever show it. The
// bottle page now renders this unconditionally (past the wishlist stage),
// so the component instance - and `justActed` - survives that status
// flip; only the buttons shown inside it change.
export default function TastedControls({ bottleId, status, quantity }) {
  const [isPending, startTransition] = useTransition();
  const [justActed, setJustActed] = useState(false);

  if (status === "wishlist") return null;

  function tasteOne() {
    startTransition(async () => {
      await markOneTasted(bottleId);
      setJustActed(true);
    });
  }

  function tasteAll() {
    startTransition(async () => {
      await setBottleStatus(bottleId, "consumed");
      setJustActed(true);
    });
  }

  function undo() {
    startTransition(async () => {
      await undoOneTasted(bottleId);
      setJustActed(false);
    });
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
      {justActed && (
        <span className="flex items-center gap-2 text-sm text-zinc-500">
          Tasted.
          <button
            type="button"
            onClick={undo}
            disabled={isPending}
            className="underline underline-offset-2"
          >
            Undo
          </button>
        </span>
      )}
    </div>
  );
}
