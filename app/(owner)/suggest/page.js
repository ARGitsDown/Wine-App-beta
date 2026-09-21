import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SuggestForm from "@/app/components/SuggestForm";

export const dynamic = "force-dynamic";

// A server component wrapping the form, for one reason: ?from=<id> reloads
// a kept pairing's request and settings so they can be changed and run
// again. Refining never needed retyping - the form stays rendered above
// the result and `request` is never cleared - but that only helps while
// the result is still on screen, and following any pick's own link
// destroyed it.
export default async function SuggestPage({ searchParams }) {
  const { from } = await searchParams;
  const fromId = Number(from);

  // The pairing count decides whether "Kept pairings" renders at all
  // (BACKLOG #24) - the link was the only clutter on a first visit, when
  // there's nothing yet to compare against; once something exists, it's
  // the one way back to it from inside the Suggest flow now that the tab
  // bar doesn't carry it (#17).
  const [pairing, pairingCount] = await Promise.all([
    Number.isInteger(fromId)
      ? prisma.savedPairing.findUnique({
          where: { id: fromId },
          select: {
            id: true,
            title: true,
            request: true,
            character: true,
            depth: true,
            includeOutside: true,
          },
        })
      : null,
    prisma.savedPairing.count(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Suggest</h1>
          <p className="text-sm text-zinc-500">
            Describe tonight&apos;s menu for a pairing, or a theme/mood for a
            tasting flight. Claude looks through your cellar (not your
            wishlist) and figures out which one you mean.
          </p>
        </div>
        {pairingCount > 0 && (
          <Link
            href="/pairings"
            className="shrink-0 text-sm underline underline-offset-2"
          >
            Kept pairings →
          </Link>
        )}
      </div>

      {/* Says what has been loaded, because a form that fills itself in
          with no explanation looks like a bug. The link back matters as
          much as the notice: the version you are about to change is still
          there, and this is how you get to it. */}
      {pairing && (
        <p className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Refining{" "}
          <Link
            href={`/pairings/${pairing.id}`}
            className="underline underline-offset-2"
          >
            {pairing.title}
          </Link>
          . Change anything below and run it again — the kept version stays as
          it is until you keep this one too.
        </p>
      )}

      <SuggestForm initial={pairing} />
    </div>
  );
}
