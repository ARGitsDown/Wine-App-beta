import { notFound } from "next/navigation";
import { db } from "@/lib/scoped-prisma";
import { formatTastedDate } from "@/lib/tasting-date";
import { pairingCard } from "@/lib/print-card";
import PrintCard from "@/app/components/PrintCard";

export const dynamic = "force-dynamic";

// A dinner card for the table: the dishes and the wines chosen for them (see
// lib/print-card.js for which wines count). Reached from the pairing's page.
export default async function PairingPrintPage({ params }) {
  const { id } = await params;
  const pairingId = Number(id);
  // A bare id in the URL: a foreign one reads as missing, like the pairing
  // page itself.
  const pairing = Number.isInteger(pairingId)
    ? await db.savedPairing.findUnique({
        where: { id: pairingId },
        include: { picks: { orderBy: { order: "asc" } } },
      })
    : null;
  if (!pairing) notFound();

  const card = pairingCard(pairing);

  return (
    <PrintCard
      backHref={`/pairings/${pairing.id}`}
      title={card.title}
      subtitle={
        [card.request, pairing.plannedFor ? formatTastedDate(pairing.plannedFor) : null]
          .filter(Boolean)
          .join(" · ") || null
      }
      note={card.suggestionsOnly && card.groups.length > 0 ? "Suggested wines - none chosen yet." : null}
    >
      {card.groups.length === 0 ? (
        <p className="text-sm text-zinc-500 print:text-black">No wines to print yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {card.groups.map((group, index) => (
            <section key={group.dish ?? `all-${index}`} className="flex flex-col gap-1">
              {group.dish && (
                <h2 className="text-lg font-medium print:text-xl">{group.dish}</h2>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.wines.map((wine, i) => (
                  <li key={i} className="text-base print:text-lg">
                    {wine}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PrintCard>
  );
}
