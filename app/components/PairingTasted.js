"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markPairingPickDrank, undoPairingPickDrank } from "@/app/actions";
import Spinner from "@/app/components/Spinner";
import { localDayInputValue } from "@/lib/tasting-date";

// "We drank it", for one wine on a saved pairing that was chosen Drink.
//
// Not yet drunk: two buttons the way a flight's rows have them - Tasted
// (takes a bottle off the count and records the evening) and With note
// (the same, then on to the bottle's page with the note form open, already
// pointed at this dish). Drunk: the choice tiles are gone and the card says
// so in words and a tick, not only in the colour Drink already wears -
// "planned" and "done" must not look alike - with how many are left and
// an Undo that puts back exactly what was taken.
//
// The day is the reader's own, chosen here: the server runs on UTC.
export default function PairingTasted({ pickId, drank, left, bottleHref, noteHref }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function run(task, then) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result?.error) setError(result.error);
      else if (then) then();
    });
  }

  if (drank) {
    return (
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-sky-700 dark:text-sky-400">
          <span className="font-medium">
            &#10003; Tasted
            {left > 0 ? ` · ${left} left` : left === 0 ? " · that was the last one" : ""}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => undoPairingPickDrank(pickId))}
            className="flex min-h-11 items-center text-zinc-500 underline underline-offset-2 disabled:opacity-50"
          >
            Undo
          </button>
          {pending && <Spinner label="Saving…" />}
        </p>
        {bottleHref && (
          <Link
            href={noteHref}
            className="-my-2 flex min-h-11 items-center text-sm text-zinc-500 underline underline-offset-2"
          >
            Add a tasting note &rarr;
          </Link>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => markPairingPickDrank(pickId, localDayInputValue()))}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-sky-300 px-1.5 text-sm font-medium text-sky-800 disabled:opacity-50 dark:border-sky-900 dark:text-sky-400"
        >
          {pending ? <Spinner label="Saving…" /> : <>&#10003; Tasted</>}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => markPairingPickDrank(pickId, localDayInputValue()), () => router.push(noteHref))
          }
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-sky-300 px-1.5 text-sm font-medium text-sky-800 disabled:opacity-50 dark:border-sky-900 dark:text-sky-400"
        >
          With note
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
