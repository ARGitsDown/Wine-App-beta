import { prisma } from "@/lib/prisma";
import { getRegionOptions } from "@/lib/bottles";
import ResearchProposalCard from "@/app/components/ResearchProposalCard";
import ResearchQueue from "@/app/components/ResearchQueue";

export const dynamic = "force-dynamic";

// Server Actions inherit their timeout from the page they're called on
// (Next's own maxDuration reference says to set it at the page level for
// exactly this), and researchBottles is the longest-running thing in the
// app by some distance: a live web search per bottle, chained step after
// step through `after()`. Left unset it ran on the platform default,
// which is where a bulk run was dying partway through and looking like
// the navigate-away bug it was supposed to have fixed.
//
// 60 rather than the higher value the hosting plan may well allow: a
// maxDuration above the plan's own ceiling is a deploy-time failure, and
// a conservative number that ships beats an ambitious one that breaks
// the build. Raise it if the plan permits - that is a one-line change
// and worth making, since it multiplies how much of a queue finishes.
//
// This raises the ceiling; it does not remove it. The whole chain still
// lives inside one invocation, so a long enough queue will still run out
// of room - see BACKLOG #17 for the per-step-invocation rewrite that
// actually makes the total length unbounded.
export const maxDuration = 60;

export default async function ResearchQueuePage() {
  // Two states, one flag plus one table: a bottle is waiting to be
  // researched (needsResearch, no proposal) or waiting to be reviewed (a
  // proposal exists). A proposal can also exist for a bottle nobody
  // flagged - you can research anything from its own page - so the review
  // list is driven by the proposals, not by the flag.
  const [proposals, toResearch, regionOptions] = await Promise.all([
    prisma.researchProposal.findMany({
      include: { bottle: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bottle.findMany({
      where: { needsResearch: true, researchProposal: { is: null } },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-zinc-500">
          Bottles the scan feature wasn&apos;t fully confident about, and
          what a web search turned up for them. Nothing is saved until you
          accept it.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Ready to review
          {proposals.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {proposals.length}
            </span>
          )}
        </h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing researched and waiting. Run one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {proposals.map((proposal) => (
              <ResearchProposalCard
                key={proposal.id}
                bottle={proposal.bottle}
                proposal={proposal}
                regionOptions={regionOptions}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          To research
          {toResearch.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {toResearch.length}
            </span>
          )}
        </h2>
        <ResearchQueue bottles={toResearch} />
      </section>
    </div>
  );
}
