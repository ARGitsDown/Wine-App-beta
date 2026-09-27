import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { deletePairing, markPairingForTonight, clearPairingForTonight } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import PairingTitle from "@/app/components/PairingTitle";
import PairingPicksList from "@/app/components/PairingPicksList";
import BackButton from "@/app/components/BackButton";
import { SUGGESTION_CHARACTERS } from "@/lib/suggestion-character";
import { DEPTH_LEVELS } from "@/lib/suggest-depth";

export const dynamic = "force-dynamic";

const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/pairings" />
      <div className="flex flex-col gap-3">
        <PairingTitle pairing={pairing} />
        {pairing.summary && (
          <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            {pairing.summary}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span>Kept {new Date(pairing.createdAt).toLocaleDateString()}</span>
          {pairing.plannedForTonight && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
              Tonight
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The first control, not the last: coming back to a kept
              pairing is usually to ask again with one thing changed. */}
          <Link
            href={`/suggest?from=${pairing.id}`}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Ask again, with changes
          </Link>
          {/* A plain toggle, not a checkbox or a status control - it's an
              owner decision with exactly one way in and one way out
              (BACKLOG #28/#39: "drink tonight" as a real state rather than
              a shortcut), so two buttons that each say what tapping them
              does reads more directly than one control with two states. */}
          {pairing.plannedForTonight ? (
            <form action={clearPairingForTonight.bind(null, pairing.id)}>
              <button type="submit" className={secondaryButtonClass}>
                Done for tonight
              </button>
            </form>
          ) : (
            <form action={markPairingForTonight.bind(null, pairing.id)}>
              <button type="submit" className={secondaryButtonClass}>
                Drink tonight
              </button>
            </form>
          )}
          <ConfirmButton
            action={deletePairing.bind(null, pairing.id)}
            label="Delete"
            confirmLabel="Yes, delete"
            warning="This pairing and its wines will be gone. The bottles themselves aren't touched."
            className={dangerButtonClass}
          />
        </div>
      </div>

      {/* What was asked, word for word, and the settings that were in
          force. Shown rather than only stored because it is half of what
          makes a kept pairing worth keeping: a month later "which one was
          the Thorough one" is a real question. */}
      <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          What was asked
        </h2>
        <p className="whitespace-pre-wrap text-sm">{pairing.request}</p>
        <p className="text-xs text-zinc-500">
          {labelFor(SUGGESTION_CHARACTERS, pairing.character)} ·{" "}
          {labelFor(DEPTH_LEVELS, pairing.depth)} ·{" "}
          {pairing.includeOutside
            ? "wines outside the cellar allowed"
            : "cellar only"}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          {pairing.picks.length === 1
            ? "The wine"
            : `The ${pairing.picks.length} wines`}
        </h2>
        <PairingPicksList picks={pairing.picks} />
      </section>
    </div>
  );
}
