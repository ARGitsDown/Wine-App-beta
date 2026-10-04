import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { flightCard } from "@/lib/print-card";
import { wineOrigin } from "@/lib/wine-origin";
import PrintCard from "@/app/components/PrintCard";

export const dynamic = "force-dynamic";

function bottleText(bottle) {
  const name = [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
  const origin = wineOrigin(bottle);
  return origin ? `${name} — ${origin}` : name;
}

// A flight card for the table: the running order, one wine per line.
export default async function FlightPrintPage({ params }) {
  const { id } = await params;
  const flightId = Number(id);
  const flight = Number.isInteger(flightId)
    ? await db.tastingFlight.findUnique({
        where: { id: flightId },
        include: {
          picks: {
            orderBy: { order: "asc" },
            include: {
              bottle: {
                select: { producer: true, bottling: true, vintage: true, region: true, subRegion: true, country: true },
              },
            },
          },
        },
      })
    : null;
  if (!flight) notFound();

  const card = flightCard(flight, bottleText);

  return (
    <PrintCard backHref={`/flights/${flight.id}`} title={card.title} subtitle={card.summary}>
      {card.wines.length === 0 ? (
        <p className="text-sm text-zinc-500 print:text-black">No wines in this flight yet.</p>
      ) : (
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          {card.wines.map((wine, i) => (
            <li key={i} className="text-base print:text-lg">
              {wine.text}
            </li>
          ))}
        </ol>
      )}
    </PrintCard>
  );
}
