import Link from "next/link";
import BackButton from "@/app/components/BackButton";
import { db } from "@/lib/scoped-prisma";
import { trashCutoff } from "@/lib/bottle-trash";
import { isAuthConfigured } from "@/lib/auth";
import { signOutOfCellar } from "@/app/signin/actions";

export const dynamic = "force-dynamic";

const rowClass =
  "flex min-h-14 w-full flex-col justify-center rounded-lg border border-zinc-200 px-4 py-2 text-left hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600";

// Everything that is about the cellar rather than in it, behind one entry on
// the home screen. These were four plain links under the cards (a backup, the
// bin, the people, signing out): things used a few times a year that made the
// home page read as untidy, and that a phone had nowhere else to put (the
// desktop header carries People and Sign out, and is hidden below 640px).
export default async function SettingsPage() {
  // Only what is still inside the 30 days (the purge is lazy).
  const binCount = await db.bottleTrash.count({ where: { deletedAt: { gte: trashCutoff() } } });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/" />
      <h1 className="text-2xl font-semibold">Settings</h1>

      <ul className="flex flex-col gap-2">
        <li>
          <Link href="/invites" className={rowClass}>
            <span className="font-medium">People &amp; Domaine</span>
            <span className="text-sm text-zinc-500">Who can open this cellar, and the cellar&apos;s name</span>
          </Link>
        </li>
        <li>
          <Link href="/deleted" className={rowClass}>
            <span className="font-medium">Recently deleted{binCount > 0 ? ` (${binCount})` : ""}</span>
            <span className="text-sm text-zinc-500">
              {binCount > 0 ? "Wines you can still bring back" : "Nothing deleted in the last 30 days"}
            </span>
          </Link>
        </li>
        <li>
          {/* A plain link, not a Link: it answers with a file to download, so
              there is no page for the router to prefetch or navigate to. */}
          <a href="/export" className={rowClass}>
            <span className="font-medium">Export all your data</span>
            <span className="text-sm text-zinc-500">A JSON backup of everything in this cellar</span>
          </a>
        </li>
        <li>
          <Link href="/import" className={rowClass}>
            <span className="font-medium">Import a list</span>
            <span className="text-sm text-zinc-500">Add wines from a spreadsheet (CSV)</span>
          </Link>
        </li>
      </ul>

      {/* Only once there is something to sign out of: an app with no accounts
          offering it would be offering to undo something that never happened. */}
      {isAuthConfigured() && (
        <form action={signOutOfCellar}>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm dark:border-zinc-700"
          >
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
