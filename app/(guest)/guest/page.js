import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";
import { GUEST_BOTTLE_SELECT, getGuestCellar, resolveGuestView } from "@/lib/guest";
import { getRegionOptions } from "@/lib/bottles";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { signOutOfCellar } from "@/app/signin/actions";
import GuestBottleList from "@/app/components/GuestBottleList";

export const dynamic = "force-dynamic";

// Where an invited Guest member browses and favorites - and, since the
// anonymous name-in-a-cookie link was retired (BACKLOG #51), only them.
// See resolveGuestView in lib/guest.js.
export default async function GuestPage({ searchParams }) {
  // With accounts switched off there is nobody to invite, so there is no
  // one this page is for. Said plainly rather than bounced, since the
  // owner is the only person who could land here and deserves the reason.
  if (!isAuthConfigured()) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Guest browsing needs an invite</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Guests are people invited to a cellar with their own sign-in, and
          accounts aren&apos;t switched on here yet — so there&apos;s nobody
          this page can show a cellar to.
        </p>
      </div>
    );
  }

  const view = await resolveGuestView();
  if (!view) {
    // Signed out: the way in is signing in. A Cellarmaster: the whole
    // app is theirs, and the owner pages are where it is.
    const session = await auth();
    redirect(session?.user?.id ? "/" : "/signin");
  }

  const { domaineId, guest, member } = view;
  // The header (app/(guest)/layout.js) already names the cellar, so the
  // page doesn't repeat it - just its motto, if it has one.
  const { motto } = await getGuestCellar(domaineId);

  // lib/scoped-prisma.js is for Cellarmasters, so this page scopes itself,
  // by the Domaine resolveGuestView settled on above.
  const [rows, regionOptions, filters] = await Promise.all([
    prisma.bottle.findMany({
      where: { status: "inventory", domaineId },
      // An allowlist (lib/guest.js): this goes to the browser.
      select: {
        ...GUEST_BOTTLE_SELECT,
        favorites: { where: { guestId: guest.id }, select: { id: true } },
      },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(domaineId),
    searchParams,
  ]);

  const bottles = rows.map(({ favorites, ...bottle }) => ({
    ...bottle,
    favorited: favorites.length > 0,
    // Same fallback as getBottles(): an older row saved before this column
    // existed still filters by grape synonym correctly.
    canonicalVariety: bottle.canonicalVariety ?? canonicalizeVarietal(bottle.type, bottle.variety),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* Their own name, or a plain welcome - never their email
              address, which is all an email-link sign-in has on file and
              read like a system record (BACKLOG #53). */}
          <h1 className="text-2xl font-semibold">
            {member.name ? `Hi, ${member.name}` : "Welcome"}
          </h1>
          {motto && (
            <p className="text-sm text-zinc-500">
              <em>&ldquo;{motto}&rdquo;</em>
            </p>
          )}
          <p className="mt-1 text-sm text-zinc-500">
            Favorite anything you&apos;d like opened on your next visit. The
            people who run this cellar can see your name next to what you
            favorite.
          </p>
        </div>
        {/* The only way out a Guest has, since the owner pages send them
            straight back here - so a real button, not small grey text. */}
        <form action={signOutOfCellar}>
          <button
            type="submit"
            className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            Sign out
          </button>
        </form>
      </div>

      <GuestBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
      />
    </div>
  );
}
