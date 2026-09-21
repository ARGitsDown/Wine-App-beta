import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { RESEARCH_STEP_PATH } from "@/lib/research-job";

// The server-only half of a bulk-research job: minting its token, and
// asking for the fresh invocation each step runs in. Split from
// lib/research-job.js because that one is imported by the progress bar,
// and node:crypto and next/headers have no business in a client bundle.

// Per job, not per deployment. A shared secret in an env var would work
// too, but it has to be configured to be correct - and an app where the
// research queue silently stops because a variable wasn't set in one
// environment is exactly the failure this rewrite is trying to end. This
// needs no configuration, is useless the moment its own job finishes, and
// never leaves the server: the browser is told a job id and nothing else.
export function newResearchJobToken() {
  return randomBytes(24).toString("hex");
}

// The app's own origin, as the request in hand describes it. Reconstructed
// from headers rather than read from a configured base URL for the same
// reason as the token above: one less thing that has to be set correctly
// per environment. Both header names can arrive as a comma-separated list
// when more than one proxy is in front of us; the first entry is the one
// nearest the client.
async function selfOrigin() {
  const headerList = await headers();
  const first = (value) => value?.split(",")[0]?.trim() || null;

  const host = first(headerList.get("x-forwarded-host")) ?? first(headerList.get("host"));
  if (!host) return null;

  const proto =
    first(headerList.get("x-forwarded-proto")) ??
    (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");

  return `${proto}://${host}`;
}

// Asks for a fresh invocation to run the job's next step, and reports
// whether the ask landed. Returns as soon as the step route has accepted
// the work - the route answers before doing any of it - so the caller
// isn't held open for the next step's research on top of its own.
//
// Callers must handle `false`. It means the queue has nobody to continue
// it, and something else has to (see researchBottles in app/actions.js).
export async function dispatchResearchStep({ id, token }) {
  try {
    const origin = await selfOrigin();
    if (!origin) {
      console.error(`Couldn't work out this app's own origin to continue research job ${id}.`);
      return false;
    }

    const response = await fetch(`${origin}${RESEARCH_STEP_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, token }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Research step handoff for job ${id} was refused:`, response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Couldn't hand off the next step of research job ${id}:`, err);
    return false;
  }
}
