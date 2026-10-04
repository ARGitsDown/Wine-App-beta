import BackButton from "@/app/components/BackButton";
import DeletedList from "@/app/components/DeletedList";
import { db } from "@/lib/scoped-prisma";
import { TRASH_DAYS, daysLeftInBin } from "@/lib/bottle-trash";

export const dynamic = "force-dynamic";

// The recycle bin: wines deleted from their own page in the last 30 days (see
// BottleTrash). The Undo bar after a delete lasts seconds; this is the way
// back after that.
export default async function DeletedPage() {
  const entries = await db.bottleTrash.findMany({
    orderBy: { deletedAt: "desc" },
    select: { id: true, label: true, deletedAt: true },
    take: 200,
  });
  // Days left are worked out from the date alone, in the server's clock; the
  // purge that enforces them runs on the next delete, so "left" is a minimum.
  const rows = entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    deleted: entry.deletedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    daysLeft: daysLeftInBin(entry.deletedAt),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/" />
      <div>
        <h1 className="text-2xl font-semibold">Recently deleted</h1>
        <p className="text-sm text-zinc-500">
          Wines you deleted from their own page, kept for {TRASH_DAYS} days with their notes, photos and links.
          Restoring puts one back exactly as it was.
        </p>
      </div>
      <DeletedList rows={rows} />
    </div>
  );
}
