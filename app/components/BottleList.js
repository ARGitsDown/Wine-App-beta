import Link from "next/link";

export default function BottleList({ bottles, emptyMessage }) {
  if (bottles.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {bottles.map((bottle) => (
        <li key={bottle.id}>
          <Link
            href={`/bottles/${bottle.id}`}
            className="block rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {bottle.producer}
                {bottle.bottling ? ` “${bottle.bottling}”` : ""}
                {bottle.vintage ? ` ${bottle.vintage}` : ""}
                {bottle.type ? ` — ${bottle.type}` : ""}
              </span>
              {bottle.averageRating !== null && (
                <span className="text-sm text-zinc-500">
                  {bottle.averageRating.toFixed(1)} ★
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-500">
              {[bottle.variety, bottle.region, bottle.country]
                .filter(Boolean)
                .join(" · ") || "No variety/region set"}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Qty: {bottle.quantity}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
