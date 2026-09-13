import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/suggest", label: "Suggest" },
  { href: "/inventory", label: "Inventory" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/consumed", label: "History" },
];

export default async function RootLayout({ children }) {
  const needsResearchCount = await prisma.bottle.count({
    where: { needsResearch: true },
  });

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium hover:underline"
              >
                {link.label}
              </Link>
            ))}
            {needsResearchCount > 0 && (
              <Link
                href="/research"
                className="font-medium text-amber-800 hover:underline dark:text-amber-400"
              >
                Research ({needsResearchCount})
              </Link>
            )}
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
