import { prisma } from "@/lib/prisma";
import { db } from "@/lib/scoped-prisma";
import { currentOwnerId } from "@/lib/owner";
import { getRegionOptions } from "@/lib/bottles";
import ResearchProposalCard from "@/app/components/ResearchProposalCard";
import ResearchQueue from "@/app/components/ResearchQueue";
import { ResearchRunProvider, ResearchRunProgress } from "@/app/components/ResearchRun";

export const dynamic = "force-dynamic";

// Server Actions inherit their timeout from the page they're called on
// (Next's own maxDuration reference says to set it at the page level for
// exactly this). A bulk run no longer spends that budget - researchBottles
// writes a job row, hands the first step to /api/research/step and
// returns, and each step after that gets its own 60s there - but two
// things on this page still want the room: researching one bottle from a
// row below, which is a live web search inline, and the fallback path
// researchBottles takes if a handoff can't be made, which finishes the
// queue inside this invocation the way the previous version did.
//
// 60 rather than the higher value the hosting plan may well allow: a
// maxDuration above the plan's own ceiling is a deploy-time failure, and
// a conservative number that ships beats an ambitious one that breaks the
// build. Raising it now only lengthens that fallback, which is the path
// nothing should be taking.
export const maxDuration = 60;

export default async function ResearchQueuePage() {
  // Two states, one flag plus one table: a bottle is waiting to be
  // researched (needsResearch, no proposal) or waiting to be reviewed (a
  // proposal exists). A proposal can also exist for a bottle nobody
  // flagged - you can research anything from its own page - so the review
  // list is driven by the proposals, not by the flag.
  const ownerId = await currentOwnerId();
  const [proposals, toResearch, regionOptions, activeJob] = await Promise.all([
    db.researchProposal.findMany({
      include: { bottle: true },
      orderBy: { createdAt: "desc" },
    }),
    db.bottle.findMany({
      where: { needsResearch: true, researchProposal: { is: null } },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(ownerId),
    // A bulk run outlives the tab that started it, so the page has to be
    // able to find one already in flight - otherwise coming back to watch
    // it would show an idle button while the server was mid-queue, which
    // is the exact confusion this whole feature exists to end. Newest
    // first, and only one: two overlapping runs would be a mistake worth
    // showing as one bar rather than two.
    //
    // researchJob isn't a model lib/scoped-prisma.js's extension covers
    // (see that file for why), so it's filtered by ownerId explicitly
    // here, on the plain client - without it, an owner would see, and the
    // progress bar would react to, another owner's job in flight.
    prisma.researchJob.findFirst({
      where: { status: "running", ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bottleIds: true,
        researched: true,
        failed: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  return (
    <ResearchRunProvider
      activeJob={
        activeJob && {
          id: activeJob.id,
          total: activeJob.bottleIds.length,
          researched: activeJob.researched,
          failed: activeJob.failed,
          status: activeJob.status,
          updatedAt: activeJob.updatedAt.toISOString(),
        }
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Research</h1>
            <p className="text-sm text-zinc-500">
              Bottles the scan feature wasn&apos;t fully confident about, and
              what a web search turned up for them. Nothing is saved until you
              accept it.
            </p>
          </div>
          {/* Above the results rather than below them: a run fills "Ready
              to review" as it goes, so a bar living down beside the button
              that started it would be pushed further off-screen the better
              it was doing. */}
          <ResearchRunProgress />
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
    </ResearchRunProvider>
  );
}
