import Anthropic from "@anthropic-ai/sdk";

// What the six AI call sites say when a request to Claude fails, in one
// place instead of six near-identical catch blocks that had already begun
// to drift.
//
// The reason for writing it now rather than leaving them alone: the key
// this app runs on has an expiry date. When it passes, every AI feature
// fails at once, and what the old blocks said was "the photo reader isn't
// configured correctly (invalid API key)" - which blames a misconfiguration
// that hasn't happened, describes nothing the reader can act on, and
// arrives identically whether the key expired, was revoked, or was never
// set. An expiry is the most likely of those by a distance and the easiest
// to fix, so it is worth naming.

// Deliberately one message for every feature. A rejected key is not a fact
// about photos or about pairings - it is a fact about the whole app, and
// six differently-worded versions of it would make one outage read like six
// unrelated bugs.
//
// Three things it has to do: not blame the reader, say what still works
// (the cellar, notes, photos and every list are plain database reads and
// are entirely unaffected), and name the fix. "Whoever runs this app"
// rather than "you" because that is already the right sentence for a guest,
// and will be the right one for every account once this app has more than
// one owner - see FUTURE_CAPABILITIES.md.
const AI_KEY_REJECTED =
  "Claude's features are unavailable right now — this app's API key was rejected, which usually means it has expired. Everything else still works normally. The key needs renewing by whoever runs this app.";

// Claude's own capacity, not this app's problem and not the owner's:
// distinct from the message above because trying again later genuinely is
// the right advice here, and identical to it is not.
const AI_OVERLOADED =
  "Claude is under heavy load right now — please try again in a moment.";

// Maps a thrown error to something worth showing someone.
//
// `busy` and `fallback` stay per-call-site because they are the two cases
// where the feature's own words help ("too many photos at once" reads
// better on the scan screen than "too many requests"), and `fallback` is
// often the place to point at the manual alternative that particular
// feature has.
//
// Nothing here returns `err.message`. The old blocks did - `Research
// error: ${err.message}` - which puts Anthropic's raw JSON body, request
// id and all, in front of someone trying to log a bottle. The detail is
// genuinely useful, so it goes to the server log, where it is for whoever
// is debugging rather than whoever is cooking.
export function aiErrorMessage(err, { busy, fallback }) {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    console.error("Anthropic rejected this app's API key:", err.status, err.message);
    return AI_KEY_REJECTED;
  }

  if (err instanceof Anthropic.RateLimitError) return busy;

  // Overload and the 5xx family are Claude's end, and the SDK has already
  // retried them by the time one reaches here.
  if (err instanceof Anthropic.InternalServerError || err?.status === 529) {
    console.error("Anthropic is overloaded or erroring:", err.status, err.message);
    return AI_OVERLOADED;
  }

  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error:", err.status, err.message);
    return fallback;
  }

  console.error("Unexpected failure calling Claude:", err);
  return fallback;
}
