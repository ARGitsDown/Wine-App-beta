import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getResearchCount } from "@/lib/bottles";
import NavLinks from "@/app/components/NavLinks";
import TabBar from "@/app/components/TabBar";
import NavigationDepthTracker from "@/app/components/NavigationDepthTracker";

// The badge is the only part of the shell that needs the database, so it
// renders on its own and streams in: awaiting it in the layout put a DB
// round-trip in front of every owner route (including /scan and /suggest,
// which never use it) and made even a fully static page unbuildable
// without a reachable database. connection() keeps this out of
// prerendering rather than having it resolve at build time.
async function ResearchNavLink() {
  await connection();
  // Flagged OR carrying a proposal, because those are two different sets and
  // this badge is the only route to /research - it isn't in NAV_LINKS, and
  // it only renders above zero. Counting flags alone meant researching a
  // bottle from its own page left a proposal waiting for review with the
  // badge still at zero and no way to reach it. The Research page's "Ready
  // to review" list is driven by the proposal table, so this now counts the
  // same work that page will show.
  const count = await getResearchCount();
  if (count === 0) return null;

  return (
    <Link
      href="/research"
      className="font-medium text-amber-800 hover:underline dark:text-amber-400"
    >
      Research ({count})
    </Link>
  );
}

// Everything the cellar's owner sees. A guest never renders this layout, so
// they never get the owner nav - and the count query above never runs for
// them either.
export default function OwnerLayout({ children }) {
  return (
    <>
      <NavigationDepthTracker />
      {/* Two navs, one at a time. The row of text links was a desktop nav
          on a phone-first app: at 375px it wrapped to two lines above every
          screen, permanently, and pushed the first bottle in the cellar to
          441px. Below 640px it is gone and the tab bar has it; above, it
          comes back unchanged and the bar is the one that hides. */}
      <header className="hidden border-b border-zinc-200 sm:block dark:border-zinc-800">
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <NavLinks />
          <Suspense fallback={null}>
            <ResearchNavLink />
          </Suspense>
        </nav>
      </header>
      {/* The bar is fixed, so it sits over the end of the page unless the
          page ends above it. 56px of bar plus a little air, and only on the
          widths where the bar exists. */}
      <main className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</main>
      <TabBar />
    </>
  );
}
