import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateBottle,
  deleteBottle,
  setBottleStatus,
  addTastingNote,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import ResearchPanel from "@/app/components/ResearchPanel";

export const dynamic = "force-dynamic";

const buttonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const dangerButtonClass =
  "rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

export default async function BottleDetailPage({ params, searchParams }) {
  const { id } = await params;
  const { pairedWith } = await searchParams;
  const bottleId = Number(id);

  const bottle = Number.isInteger(bottleId)
    ? await prisma.bottle.findUnique({
        where: { id: bottleId },
        include: {
          tastingNotes: { orderBy: { tastedAt: "desc" } },
          favorites: { include: { guest: true } },
        },
      })
    : null;

  if (!bottle) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {bottle.producer}
            {bottle.vintage ? ` ${bottle.vintage}` : ""}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm capitalize text-zinc-500">{bottle.status}</p>
            {bottle.needsResearch && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                Needs research
              </span>
            )}
          </div>
          {bottle.favorites.length > 0 && (
            <p className="mt-1 text-sm text-zinc-500">
              ❤️ Favorited by {bottle.favorites.map((f) => f.guest.name).join(", ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {bottle.status === "wishlist" && (
            <form action={setBottleStatus.bind(null, bottle.id, "inventory")}>
              <button className={buttonClass} type="submit">
                Bought it → move to inventory
              </button>
            </form>
          )}
          {bottle.status === "inventory" && (
            <form action={setBottleStatus.bind(null, bottle.id, "consumed")}>
              <button className={buttonClass} type="submit">
                Mark as finished
              </button>
            </form>
          )}
          <form action={deleteBottle.bind(null, bottle.id)}>
            <button className={dangerButtonClass} type="submit">
              Delete
            </button>
          </form>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Details</h2>
        <BottleForm
          action={updateBottle.bind(null, bottle.id)}
          defaultValues={bottle}
          submitLabel="Save changes"
        />
      </section>

      <ResearchPanel bottle={bottle} />

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Tasting notes</h2>

        {bottle.tastingNotes.length === 0 && (
          <p className="text-sm text-zinc-500">No tasting notes yet.</p>
        )}

        <ul className="flex flex-col gap-3">
          {bottle.tastingNotes.map((tastingNote) => (
            <li
              key={tastingNote.id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>
                  {new Date(tastingNote.tastedAt).toLocaleDateString()}
                </span>
                <span>
                  {tastingNote.rating !== null
                    ? `${tastingNote.rating} / 5 ★`
                    : "No rating"}
                </span>
              </div>
              <p className="mt-1">{tastingNote.note}</p>
            </li>
          ))}
        </ul>

        <form
          action={addTastingNote.bind(null, bottle.id)}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <label className="flex flex-col gap-1 text-sm">
            Note
            <textarea
              name="note"
              required
              rows={3}
              defaultValue={pairedWith ? `Paired with: ${pairedWith}\n\n` : ""}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex max-w-[8rem] flex-col gap-1 text-sm">
            Rating (1–5, optional)
            <input
              name="rating"
              type="number"
              min="1"
              max="5"
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button type="submit" className={`self-start ${buttonClass}`}>
            Add tasting note
          </button>
        </form>
      </section>
    </div>
  );
}
