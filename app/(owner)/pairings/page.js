import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pairingSummaryLine } from "@/lib/pairings";

export const dynamic = "force-dynamic";

// Not in the nav, deliberately: the nav is already at seven links and
// where the eighth goes is the open question in BACKLOG #17. Suggest links
// here, which is where you would look anyway - you come back to a kept
// pairing to run it again.
export default async function PairingsPage() {
  const pairings = await prisma.savedPairing.findMany({
    include: {
      picks: {
        select: { dish: true, wineName: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Kept pairings</h1>
        <p className="text-sm text-zinc-500">
          A dish and its wine, or a whole menu and its wines — the ones you
          decided were worth writing down.
        </p>
      </div>

      {pairings.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing kept yet. Ask{" "}
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
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <Link
                href={`/pairings/${pairing.id}`}
                className="font-medium underline underline-offset-2"
              >
                {pairing.title}
              </Link>
              <p className="mt-1 text-sm text-zinc-500">
                {pairingSummaryLine(pairing)}
              </p>
              {/* The request, not the model's summary: what you asked for
                  is what you will recognize a month later. */}
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {pairing.request}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Kept {new Date(pairing.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
