// Strips tool-call serialization that a model has leaked into a text field
// it was supposed to fill with prose.
//
// Observed once in twenty Suggest runs on 2026-09-21 (BACKLOG #23). Sonnet
// ended a pairing summary mid-sentence and then wrote, inside the string:
//
//   ...to the richest and sweetest.</summary>
//   <parameter name="picks">[{"bottleId":51,"pairingContext":...
//
// The tool call itself parsed correctly - the picks came through intact and
// every bottle resolved - so nothing downstream had any reason to suspect a
// problem. Only the prose was contaminated, and that prose is written
// straight to SavedPairing.summary and rendered on the pairing page, so the
// whole of it would have been sitting in the cellar unreadable.
//
// Not a bug that can be fixed where it happens, because it does not happen
// here: no prompt makes a model perfectly incapable of this, and a rarity
// that corrupts stored data is worse than one that merely looks wrong once.
// So this is a guard at the boundary, and it is deliberately narrow - it
// cuts at the first marker and keeps everything before it, because the
// prose up to that point was real and worth keeping.
//
// The patterns are shapes no wine writing produces. A summary may well
// contain "<" (a vintage comparison, a score), so "<" alone is not a
// marker; only a closing tag for one of the tool's own field names, or the
// opening of a parameter block, counts.
const LEAKED_TOOL_SYNTAX =
  /<\/(summary|title|reason|picks|parameter|invoke|function_calls)\s*>|<parameter\s+name\s*=|<(invoke|function_calls)\b/i;

export function cleanModelText(value) {
  if (typeof value !== "string") return value;
  const match = value.match(LEAKED_TOOL_SYNTAX);
  if (!match) return value;
  console.error(
    "Trimmed leaked tool syntax from a model text field at index",
    match.index,
    "- marker:",
    match[0]
  );
  return value.slice(0, match.index).trim();
}

// The same guard for a tool result rather than a lone string: clean the
// named fields, leave everything else exactly as it is.
//
// Only the prose fields are worth naming. A leak is a run-on - the model
// keeps writing past the end of a field - so it lands in whatever it was
// writing when it went wrong, and that is overwhelmingly the long free-text
// one. Running this over an integer vintage or a boolean would be noise,
// and running it over every string would eventually trim a producer whose
// name legitimately contains an angle bracket.
export function cleanModelFields(input, keys) {
  if (!input || typeof input !== "object") return input;
  const cleaned = { ...input };
  for (const key of keys) {
    if (typeof cleaned[key] === "string") cleaned[key] = cleanModelText(cleaned[key]);
  }
  return cleaned;
}
