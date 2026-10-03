import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAppOwner } from "@/lib/owner";
import { cellarDisplayName } from "@/lib/cellar-name";
import { usageState, formatCents, formatMicros, formatResetDate, monthStartUTC, nextMonthStartUTC } from "@/lib/usage-policy";
import { RATES_AS_OF } from "@/lib/usage-pricing";
import UsageLimitsForm from "@/app/components/UsageLimitsForm";
import ProgressBar from "@/app/components/ProgressBar";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

const STATE_LABEL = {
  ok: null,
  lighter: "Over cap - on lighter models",
  stopped: "Paused",
};

// Every Domaine's AI spend this month, and where its limits are set - the
// one screen that reads *across* Domaines, which is why it's for the app
// owner alone (isAppOwner in lib/owner.js) and answers anyone else as if it
// didn't exist. The same check guards the action behind the form, which is
// the one that matters: this page hiding itself is a courtesy, not the
// lock.
export default async function UsagePage() {
  if (!(await isAppOwner())) notFound();

  const now = new Date();
  const since = monthStartUTC(now);
  const [domaines, totals, byFeature, lighterCalls] = await Promise.all([
    prisma.domaine.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        monthlySpendCapCents: true,
        monthlyHardStopCents: true,
        members: {
          orderBy: { createdAt: "asc" },
          select: { name: true, email: true, role: true },
        },
      },
    }),
    prisma.usageEvent.groupBy({
      by: ["domaineId"],
      where: { createdAt: { gte: since } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["domaineId", "feature"],
      where: { createdAt: { gte: since } },
      _sum: { costMicros: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["domaineId"],
      where: { createdAt: { gte: since }, lighter: true },
      _count: { _all: true },
    }),
  ]);

  const spentBy = new Map(totals.map((row) => [row.domaineId, row]));
  const lighterBy = new Map(lighterCalls.map((row) => [row.domaineId, row._count._all]));
  const featuresBy = new Map();
  for (const row of byFeature) {
    if (!featuresBy.has(row.domaineId)) featuresBy.set(row.domaineId, []);
    featuresBy.get(row.domaineId).push(row);
  }

  const rows = domaines
    .map((domaine) => {
      const founder = domaine.members.find((member) => member.role === "cellarmaster");
      const spentMicros = spentBy.get(domaine.id)?._sum.costMicros ?? 0;
      return {
        domaine,
        title: cellarDisplayName(domaine, founder),
        spentMicros,
        calls: spentBy.get(domaine.id)?._count._all ?? 0,
        lighter: lighterBy.get(domaine.id) ?? 0,
        features: (featuresBy.get(domaine.id) ?? []).sort((a, b) => b._sum.costMicros - a._sum.costMicros),
        state: usageState({
          spentMicros,
          capCents: domaine.monthlySpendCapCents,
          hardStopCents: domaine.monthlyHardStopCents,
        }),
      };
    })
    .sort((a, b) => b.spentMicros - a.spentMicros);

  const total = rows.reduce((sum, row) => sum + row.spentMicros, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/invites" />

      <div>
        <h1 className="text-2xl font-semibold">Usage</h1>
        <p className="text-sm text-zinc-500">
          What each Domaine has spent on Claude this month, on your API key. Resets on{" "}
          {formatResetDate(nextMonthStartUTC(now))}. Past its <strong>cap</strong> a Domaine&apos;s AI
          features keep working on a lighter model; past its <strong>hard stop</strong> they pause until
          the 1st. Blank means no limit.
        </p>
        <p className="mt-2 text-lg">
          <span className="font-semibold">{formatMicros(total)}</span>
          <span className="text-zinc-500"> across all {rows.length} Domaine{rows.length === 1 ? "" : "s"} so far</span>
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map(({ domaine, title, spentMicros, calls, lighter, features, state }) => (
          <li
            key={domaine.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div>
              <h2 className="font-medium">{title}</h2>
              <p className="text-xs text-zinc-500">
                {domaine.members.length === 0
                  ? "No members - left behind by an account deleted outside the app."
                  : domaine.members.map((member) => member.name || member.email || "unclaimed").join(", ")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 text-sm">
              <p>
                <span className="text-lg font-semibold">{formatMicros(spentMicros)}</span>
                <span className="text-zinc-500">
                  {domaine.monthlySpendCapCents != null
                    ? ` of ${formatCents(domaine.monthlySpendCapCents)}`
                    : " - no cap"}
                  {" · "}
                  {calls} call{calls === 1 ? "" : "s"}
                  {lighter > 0 ? ` (${lighter} on lighter models)` : ""}
                </span>
              </p>
              {domaine.monthlySpendCapCents != null && (
                <ProgressBar
                  value={Math.min(spentMicros, domaine.monthlySpendCapCents * 10_000)}
                  max={domaine.monthlySpendCapCents * 10_000}
                  label={`${title}: AI allowance used this month`}
                  height="h-2"
                  barClassName={
                    state === "ok" ? "bg-zinc-900 dark:bg-zinc-100" : state === "lighter" ? "bg-amber-500" : "bg-red-600"
                  }
                />
              )}
              {STATE_LABEL[state] && <p className="font-medium text-amber-700 dark:text-amber-400">{STATE_LABEL[state]}</p>}
              {features.length > 0 && (
                <p className="text-xs text-zinc-500">
                  {features.map((row) => `${row.feature} ${formatMicros(row._sum.costMicros)}`).join(" · ")}
                </p>
              )}
            </div>

            <UsageLimitsForm
              domaineId={domaine.id}
              capCents={domaine.monthlySpendCapCents}
              hardStopCents={domaine.monthlyHardStopCents}
            />
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500">
        Costs are computed when each call finishes, from Anthropic&apos;s published per-token prices as
        of {RATES_AS_OF} (<code>lib/usage-pricing.js</code>), so they&apos;re estimates - the invoice is
        the authority. Calls made before this page existed aren&apos;t counted.
      </p>
    </div>
  );
}
