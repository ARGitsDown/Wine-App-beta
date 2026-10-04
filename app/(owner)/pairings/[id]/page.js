import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { deletePairing } from "@/app/actions";
import { decisionCounts, tonightLabel } from "@/lib/pairings";
import ConfirmButton from "@/app/components/ConfirmButton";
import PairingTitle from "@/app/components/PairingTitle";
import PairingPicksList from "@/app/components/PairingPicksList";
import BackButton from "@/app/components/BackButton";
import ExpandableText from "@/app/components/ExpandableText";
import TonightToggle from "@/app/components/TonightToggle";
import { SUGGESTION_CHARACTERS } from "@/lib/suggestion-character";
import { DEPTH_LEVELS } from "@/lib/suggest-depth";

export const dynamic = "force-dynamic";

const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default async function PairingDetailPage({ params }) {
  const { id } = await params;
  const pairingId = Number(id);

  // Reached by a bare id in the URL, so a foreign id has to read exactly
  // like a deleted pairing - notFound() below - rather than rendering
  // someone else's.
  const pairing = Number.isInteger(pairingId)
    ? await db.savedPairing.findUnique({
        where: { id: pairingId },
        include: {
          picks: {
            include: {
              bottle: {
                select: { id: true, producer: true, status: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      })
    : null;

  if (!pairing) notFound();

  const counts = decisionCounts(pairing.picks);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/pairings" />

      {/* Row 1: the title. Row 2: what was asked. Then the wines. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <PairingTitle pairing={pairing} />
          {/* Teal, matching the Pairings card's own accent on home - amber
              was already "needs a check" (Needs research, unsaved) and
              Wishlist elsewhere in the app, so the same color meant two
              unrelated things on this one screen (a UX review,
              2026-09-27). */}
          {tonightLabel(pairing) && (
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs text-teal-800 dark:bg-teal-950 dark:text-teal-400">
              {tonightLabel(pairing)}
            </span>
          )}
        </div>
        <ExpandableText
          text={pairing.request}
          lines={2}
          className="text-sm text-zinc-600 dark:text-zinc-400"
        />
        {/* Where "undecided" is named: it has no button of its own, it is
            what a wine is until Drink or Hold is chosen. */}
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-sky-700 dark:text-sky-400">
            {counts.drink} to drink
          </span>{" "}
          &middot; {counts.hold} on hold &middot; {counts.undecided} undecided
        </p>
      </div>

      <PairingPicksList picks={pairing.picks} plannedForTonight={pairing.plannedForTonight} />

      {/* The model's own "why these", about the set rather than any one
          wine - after the wines because the per-wine reasons are what the
          choices are made on. */}
      {pairing.summary && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            About this pairing
          </h2>
          <ExpandableText
            text={pairing.summary}
            lines={3}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
        </section>
      )}

      {/* The evening ends here, not at the top of the page (a UX review,
          2026-09-27). A plain toggle, not a checkbox or a status control -
          it's an owner decision with exactly one way in and one way out
          (BACKLOG #28/#39: "drink tonight" as a real state rather than a
          shortcut). The rarely-used controls and the record of what was
          asked sit quietly under it. */}
      <div className="flex flex-col items-start gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <TonightToggle pairingId={pairing.id} plannedForTonight={pairing.plannedForTonight} />
        <div className="flex flex-wrap items-center gap-x-4">
          {/* Coming back to a kept pairing is usually to ask again with one
              thing changed. */}
          <Link
            href={`/suggest?from=${pairing.id}`}
            className="flex min-h-11 items-center text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
          >
            Ask again, with changes
          </Link>
          <ConfirmButton
            action={deletePairing.bind(null, pairing.id)}
            label="Delete"
            confirmLabel="Yes, delete"
            warning="This pairing and its wines will be gone. The bottles themselves aren't touched."
            className="flex min-h-11 items-center text-sm text-red-600 underline underline-offset-2 dark:text-red-400"
            confirmClassName={dangerButtonClass}
          />
        </div>
        {/* What was asked, and the settings in force. Kept because it is
            half of what makes a kept pairing worth keeping: a month later
            "which one was the Thorough one" is a real question. */}
        <p className="text-xs text-zinc-500">
          Kept {new Date(pairing.createdAt).toLocaleDateString()} &middot;{" "}
          {labelFor(SUGGESTION_CHARACTERS, pairing.character)} &middot;{" "}
          {labelFor(DEPTH_LEVELS, pairing.depth)} &middot;{" "}
          {pairing.includeOutside ? "wines outside the cellar allowed" : "cellar only"}
        </p>
      </div>
    </div>
  );
}
