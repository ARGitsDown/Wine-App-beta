import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deletePairing } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import PairingTitle from "@/app/components/PairingTitle";
import PairingPicksList from "@/app/components/PairingPicksList";
import BackButton from "@/app/components/BackButton";
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

  const pairing = Number.isInteger(pairingId)
    ? await prisma.savedPairing.findUnique({
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
        <p className="text-sm text-zinc-500">
          Kept {new Date(pairing.createdAt).toLocaleDateString()}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* The first control, not the last: coming back to a kept
              pairing is usually to ask again with one thing changed. */}
          <Link
            href={`/suggest?from=${pairing.id}`}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Ask again, with changes
          </Link>
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
