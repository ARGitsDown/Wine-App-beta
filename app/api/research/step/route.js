import { after } from "next/server";
import { runResearchJobStep } from "@/app/actions";
import { dispatchResearchStep } from "@/lib/research-dispatch";

export const dynamic = "force-dynamic";

// The point of the whole arrangement: every step is its own request, so
// every step gets this budget from scratch and the total length of a bulk
// run is bounded by nothing. 60 rather than something larger for the same
// reason the research page settled on it - a maxDuration above the hosting
// plan's own ceiling fails the build - and it matters far less here, since
// running out of room now costs one step rather than the rest of the queue.
export const maxDuration = 60;

// Not a public API so much as the app asking itself to keep going. It
// exists because a Server Action can't be invoked by hand-writing an HTTP
// request (the protocol is a POST to a page carrying an encoded action id),
// and a fresh HTTP request is exactly what a fresh timeout requires.
//
// Unauthenticated in the ordinary sense, because the app has no
// authentication yet (see FUTURE_CAPABILITIES.md) - the job's own token is
// the guard, and runResearchJobStep does nothing without it. A caller who
// guesses a job id and not its token gets the same empty 202 as one who
// guesses neither, which is also why nothing here reports whether a job
// exists.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const id = Number(body?.id);
  const token = typeof body?.token === "string" ? body.token : null;
  if (!Number.isInteger(id) || !token) {
    return Response.json({ error: "Expected a job id and token." }, { status: 400 });
  }

  // Answer first, work afterwards. The caller is the previous step (or the
  // action that started the run), and holding it open until this step's
  // research finished would chain the invocations end to end instead of
  // handing off between them - which is the ceiling this replaced.
  after(async () => {
    try {
      if (await runResearchJobStep(id, token)) {
        await dispatchResearchStep({ id, token });
      }
    } catch (err) {
      // The job row keeps whatever progress was written before this, so a
      // run that dies here is a run that stops early, not one that loses
      // what it did. The page notices the row going quiet and says so.
      console.error(`Research job ${id} couldn't continue:`, err);
    }
  });

  return new Response(null, { status: 202 });
}
