import { db } from "@/lib/scoped-prisma";
import EstimateWindowsPanel from "@/app/components/EstimateWindowsPanel";

export const dynamic = "force-dynamic";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling, bottle.vintage].filter(Boolean).join(" ");
}

export default async function EstimateWindowsPage() {
  const bottles = await db.bottle.findMany({
    where: { status: "inventory", drinkFrom: null, drinkTo: null },
    select: {
      id: true,
      producer: true,
      bottling: true,
      vintage: true,
      type: true,
      variety: true,
      region: true,
      subRegion: true,
      country: true,
    },
    orderBy: { producer: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Estimate drinking windows</h1>
        <p className="text-sm text-zinc-500">
          A one-time pass across every bottle in your cellar currently missing a
          drinking window. Claude proposes a best estimate for each from its
          general knowledge of the producer/variety/region/vintage - no web
          search - applied directly rather than reviewed one by one, since
          that isn&apos;t practical across hundreds of bottles. Every
          estimate is marked &quot;estimated&quot; on the bottle&apos;s own
          page afterward and can be corrected any time.
        </p>
      </div>

      {/* The panel is rendered unconditionally, including its own empty
          state. A finished run leaves no bottle missing a window, so
          branching on that list here used to replace the panel - and its
          result summary - the instant the work completed, meaning you never
          got to read what happened. */}
      {bottles.length > 0 && (
        <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm text-zinc-500">
            Show the {bottles.length} bottle{bottles.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {bottles.map((bottle) => (
              <li key={bottle.id}>{bottleHeader(bottle)}</li>
            ))}
          </ul>
        </details>
      )}
      <EstimateWindowsPanel bottles={bottles} />
    </div>
  );
}
