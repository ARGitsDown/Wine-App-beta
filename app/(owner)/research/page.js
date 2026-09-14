import { prisma } from "@/lib/prisma";
import { getRegionOptions } from "@/lib/bottles";
import ResearchProposalCard from "@/app/components/ResearchProposalCard";
import ResearchQueue from "@/app/components/ResearchQueue";

export const dynamic = "force-dynamic";

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
