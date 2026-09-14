import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Cellarmaster",
  description: "A personal wine cellar, wishlist, and tasting log.",
  appleWebApp: {
    title: "Cellarmaster",
    statusBarStyle: "black-translucent",
  },
};

// Matches the app icon's ground, so the status bar carries the mark's
// color when the app runs standalone.
export const viewport = {
  themeColor: "#4a1523",
};

// Only the document shell lives here. The header is deliberately not in it:
// the owner and a visiting guest get genuinely different chrome, so each
// route group brings its own (see app/(owner)/layout.js and
// app/(guest)/layout.js). Putting the owner's nav here meant a guest was
// shown - and could click straight into - every owner-only page.
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
