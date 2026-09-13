import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dismissResearch } from "@/app/actions";

export const dynamic = "force-dynamic";

function bottleHeader(bottle) {
  return [
    bottle.producer,
    bottle.bottling ? `“${bottle.bottling}”` : null,
    bottle.vintage || null,
    bottle.type || null,
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function ResearchQueuePage() {
  const bottles = await prisma.bottle.findMany({
    where: { needsResearch: true },
    orderBy: { producer: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Needs research</h1>
        <p className="text-sm text-zinc-500">
          Bottles the scan feature wasn&apos;t fully confident about, across
          inventory, wishlist, and history. Open one to run a real web
          search, or dismiss it here if the current details look fine.
        </p>
      </div>

      {bottles.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing needs research right now.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bottles.map((bottle) => (
            <li
              key={bottle.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
            >
              <Link
                href={`/bottles/${bottle.id}`}
                className="font-medium underline underline-offset-2"
              >
                {bottleHeader(bottle)}
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs capitalize text-zinc-500">{bottle.status}</span>
                <form action={dismissResearch.bind(null, bottle.id)}>
                  <button
                    type="submit"
                    className="text-xs text-zinc-500 underline underline-offset-2"
                  >
                    Dismiss
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
