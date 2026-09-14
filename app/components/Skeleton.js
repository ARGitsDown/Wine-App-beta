// Placeholder shapes for a route's loading.js. Every page in the app is
// force-dynamic, so a navigation waits on the database before anything
// renders; a loading.js streams this instantly instead, which is the
// difference between the app feeling slow and feeling like it's working.
//
// Deliberately approximate: the point is a page-shaped placeholder that
// doesn't shift much when the real content lands, not a pixel-accurate
// copy of it.

export function SkeletonLine({ className = "h-4 w-full" }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonHeader({ subtitle = true }) {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonLine className="h-7 w-48" />
      {subtitle && <SkeletonLine className="h-4 w-72 max-w-full" />}
    </div>
  );
}

export function SkeletonRows({ count = 6 }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 px-4 py-3.5 dark:border-zinc-800"
        >
          <SkeletonLine className="h-4 w-[60%]" />
        </div>
      ))}
    </div>
  );
}

// The shell every list route (Cellar/Wishlist/Tasting notes/Guest) shares.
export function SkeletonListPage({ rows = 6 }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <SkeletonHeader />
      <SkeletonLine className="h-11 w-full rounded-lg" />
      <SkeletonRows count={rows} />
    </div>
  );
}
