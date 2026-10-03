import Link from "next/link";
import { isAppOwner } from "@/lib/owner";
import { formatCents, formatMicros, formatResetDate } from "@/lib/usage-policy";
import ProgressBar from "@/app/components/ProgressBar";

// This month's AI spend for one Domaine, for its own Cellarmasters - on the
// People page, where a number shared by everyone in the cellar belongs.
// Everyone who can spend the allowance can see what's left of it; the
// limits themselves are set by the app owner (see /usage), which is also
// why a cap here is stated rather than editable.
//
// `status` is monthlyUsage()'s result for the Domaine; it is passed in,
// not fetched here, because the page already has to read it.
export default async function AiUsageSummary({ status }) {
  const operator = await isAppOwner();
  const { spentMicros, capCents, hardStopCents, state, resetsAt } = status;
  const resets = formatResetDate(resetsAt);

  const headline =
    state === "stopped"
      ? `Paused until ${resets}`
      : state === "lighter"
        ? `Over the allowance - running on lighter models until ${resets}`
        : "Running normally";

  return (
    <section id="ai-use" className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <h2 className="font-medium">AI this month</h2>
        <p className="text-sm text-zinc-500">
          Scan, Suggest, Research and drinking-window estimates are shared by everyone in this
          Domaine, and reset on the 1st.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
        <p>
          <span className="text-lg font-semibold">{formatMicros(spentMicros)}</span>
          {capCents != null ? (
            <span className="text-zinc-500"> of {formatCents(capCents)}</span>
          ) : (
            <span className="text-zinc-500"> used - no monthly limit on this cellar</span>
          )}
        </p>
        {capCents != null && (
          <ProgressBar
            value={Math.min(spentMicros, capCents * 10_000)}
            max={capCents * 10_000}
            label="AI allowance used this month"
            height="h-2"
            barClassName={
              state === "ok" ? "bg-zinc-900 dark:bg-zinc-100" : state === "lighter" ? "bg-amber-500" : "bg-red-600"
            }
          />
        )}
        <p className={state === "ok" ? "text-zinc-500" : "font-medium"}>{headline}</p>
        {capCents != null && state !== "stopped" && (
          <p className="text-xs text-zinc-500">
            Past {formatCents(capCents)} Suggest, Research and estimates keep working on a lighter
            model; Scan stays at full strength
            {hardStopCents != null ? `. At ${formatCents(hardStopCents)} AI features pause until ${resets}` : ""}.
          </p>
        )}
      </div>

      {operator && (
        <Link href="/usage" className="self-start text-sm underline underline-offset-2">
          Usage across every Domaine →
        </Link>
      )}
    </section>
  );
}
