import ScanPanel from "@/app/components/ScanPanel";
import { normalizeScanIntent } from "@/lib/scan-intent";

export const dynamic = "force-dynamic";

// A thin server page over the scanner, so ?intent= can be read the same way
// every other page in the app reads its state - awaited off searchParams.
// The alternative, useSearchParams() inside the scanner itself, would put a
// Suspense boundary around the whole thing to no benefit.
export default async function ScanPage({ searchParams }) {
  const { intent } = await searchParams;
  return <ScanPanel initialIntent={normalizeScanIntent(intent)} />;
}
