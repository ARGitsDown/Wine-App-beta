import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NavLinks from "@/app/components/NavLinks";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Wine Tracker",
  description: "A personal wine cellar, wishlist, and tasting log.",
  appleWebApp: {
    title: "Wine Tracker",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#18181b",
};

// The badge is the only part of the shell that needs the database, so it
// renders on its own and streams in: awaiting it in the layout put a DB
// round-trip in front of every single route (including /scan and /suggest,
// which never use it) and made even a fully static page unbuildable
// without a reachable database. connection() keeps this out of
// prerendering rather than having it resolve at build time.
async function ResearchNavLink() {
  await connection();
  const count = await prisma.bottle.count({ where: { needsResearch: true } });
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

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <NavLinks />
            <Suspense fallback={null}>
              <ResearchNavLink />
            </Suspense>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
