import Link from "next/link";
import { currentCellarmaster } from "@/lib/owner";
import { monthlyUsage } from "@/lib/usage";
import { formatResetDate } from "@/lib/usage-policy";

// Says so when this cellar is past its monthly AI allowance, at the top of
// the pages that spend it (Suggest, Scan, Research, Estimate windows).
//
// Nothing at all while the Domaine is under its cap, which is nearly
// always: a limit that shows itself every day is a nag, and one that shows
// itself only when it changes what happens is information. The point of
// having it is the one case this app can't otherwise explain - a feature
// that is suddenly a little less thorough, or not working - since "a cap
// with nothing that ever tells anyone" is a surprise, not a limit.
//
// Over the cap, the features still work, one model tier down, so the note
// says that first and plainly; at the hard stop they don't, so it says
// that, and when they come back. Never throws: a page must not fail
// because it couldn't draw a notice.
export default async function AiLimitNotice({ bare = false, feature }) {
  let status;
  try {
    const { domaineId } = await currentCellarmaster();
    status = await monthlyUsage(domaineId);
  } catch {
    return null;
  }
  if (status.state === "ok") return null;
  // Scan is held on its normal model over the cap (holdTier in
  // lib/usage.js), so "running on lighter models" would be false there:
  // it only has something to say once Scan itself is paused.
  if (feature === "scan" && status.state === "lighter") return null;

  const resets = formatResetDate(status.resetsAt);
  const stopped = status.state === "stopped";

  const note = (
    <p
      role="status"
      className={`rounded-lg border p-3 text-sm ${
        stopped
          ? "border-red-300 text-red-800 dark:border-red-900 dark:text-red-300"
          : "border-amber-300 dark:border-amber-900"
      }`}
    >
      {stopped ? (
        <>
          <span className="font-medium">AI features are paused until {resets}.</span> This cellar
          has reached its monthly limit. Everything else still works normally.
        </>
      ) : (
        <>
          <span className="font-medium">Running on lighter models until {resets}.</span> This
          cellar has used its monthly AI allowance, so Suggest, Research and estimates still work
          but may be a little less thorough. Scan still reads labels at full strength.
        </>
      )}{" "}
      <Link href="/invites#ai-use" className="underline underline-offset-2">
        See what&apos;s been used
      </Link>
    </p>
  );

  return bare ? note : <div className="mx-auto w-full max-w-3xl px-4 pt-4">{note}</div>;
}
