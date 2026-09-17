"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createBottle,
  getSuggestions,
  savePairing,
  saveTastingFlight,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import Spinner from "@/app/components/Spinner";
import {
  SUGGESTION_CHARACTERS,
  DEFAULT_CHARACTER,
} from "@/lib/suggestion-character";
import { EFFORT_LEVELS, DEFAULT_EFFORT } from "@/lib/effort";

const buttonClass =
  "self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";

function bottleHeader(bottle) {
  return [
    bottle.producer,
    bottle.bottling ? `“${bottle.bottling}”` : null,
    bottle.vintage || null,
  ]
    .filter(Boolean)
    .join(" ");
}

// The same line the gap card itself shows, so a note about what was left
// out of a flight names each wine the way the card above it does.
function gapHeader(gap) {
  return [gap.producer, gap.type].filter(Boolean).join(" — ");
}

// What to call a gap wine in a sentence. The card's own heading pairs the
// producer with the grape, which reads fine as a heading and badly mid-
// sentence next to a second one - so a sentence uses the producer alone,
// and only falls back to the full heading when there isn't one.
function gapName(gap) {
  return gap.producer || gapHeader(gap);
}

// "A and B", "A, B and C". Two or three wines left out of a flight is the
// normal case and reads better named than counted.
function andList(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// `initial` is a saved pairing loaded back in to be refined - the request
// verbatim and the three settings that were in force. Everything else
// starts empty: the wines are not restored, because the point of refining
// is to get different ones.
export default function SuggestForm({ initial = null }) {
  const [request, setRequest] = useState(initial?.request ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [includeOutside, setIncludeOutside] = useState(
    initial?.includeOutside ?? false
  );
  const [character, setCharacter] = useState(
    initial?.character ?? DEFAULT_CHARACTER
  );
  const [effort, setEffort] = useState(initial?.effort ?? DEFAULT_EFFORT);
  // Seeded once from whether the three settings already differ from their
  // defaults - the same rule FilterBar's panel uses for itself
  // (`hasAnyFilter`, seeded once on mount). That covers a refine load from a
  // kept pairing (`initial` rarely carries all-default settings) as much as
  // it covers FilterBar's bookmarked-URL case, without resetting every time
  // a new result comes in - left open once opened, same as FilterBar.
  const [optionsOpen, setOptionsOpen] = useState(
    () => character !== DEFAULT_CHARACTER || effort !== DEFAULT_EFFORT || includeOutside
  );
  const [savedGapIds, setSavedGapIds] = useState(new Set());
  // Which gap cards have their wishlist form showing. Held here rather than
  // left to the <details> element because saving a flight opens the forms
  // for the wines it could not include - the offer has to be the thing you
  // are looking at, not a sentence telling you where to find it.
  const [expandedGaps, setExpandedGaps] = useState(new Set());
  const [flightSave, setFlightSave] = useState({ status: "idle" });
  const [pairingSave, setPairingSave] = useState({ status: "idle" });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!request.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setFlightSave({ status: "idle" });
    setPairingSave({ status: "idle" });
    // Both are keyed by position in result.picks, so they mean nothing once
    // the picks change: without this, wishlisting pick #1 of one search left
    // pick #1 of the next claiming to be on the wishlist already.
    setSavedGapIds(new Set());
    setExpandedGaps(new Set());

    const response = await getSuggestions(
      request,
      includeOutside,
      character,
      effort
    );
    if (response.error) {
      setError(response.error);
    } else {
      setResult(response.data);
    }
    setLoading(false);
  }

  // The other half of what a Suggest result can become. Unlike a flight,
  // a pairing keeps the wines you do not own as well - "buy this for that
  // dish" is the whole point of the include-outside toggle - so nothing
  // is left behind and there is nothing to warn about.
  //
  // What is saved is `result.asked`, not what is in the form now: the form
  // stays editable while a result is on screen, so reading it here would
  // file a request that did not produce these wines.
  async function handleSavePairing() {
    setPairingSave({ status: "saving" });
    const response = await savePairing({
      title: result.title,
      summary: result.summary,
      ...result.asked,
      picks: result.picks.map((pick) => ({
        bottleId: pick.bottle ? pick.bottle.id : null,
        gap: pick.gap,
        dish: pick.pairingContext,
        reason: pick.reason,
      })),
    });
    if (response.error) {
      setPairingSave({ status: "error", error: response.error });
    } else {
      setPairingSave({ status: "saved", id: response.data.id });
    }
  }

  // A flight is a queue of bottles you can open, so a wine you do not own
  // genuinely cannot go in one - FlightPick.bottleId is NOT NULL for that
  // reason. What was wrong was doing it silently: you asked for a flight of
  // five and got a saved flight of three with no indication the other two
  // had gone anywhere. So the picks that cannot be saved are named, and
  // their wishlist forms are opened, which is the only place left for them.
  async function handleSaveFlight() {
    const ownedPicks = [];
    const missing = [];
    result.picks.forEach((pick, index) => {
      if (pick.bottle) {
        ownedPicks.push({ bottleId: pick.bottle.id, reason: pick.reason });
      } else {
        missing.push(index);
      }
    });

    if (ownedPicks.length === 0) {
      setExpandedGaps(new Set(missing));
      setFlightSave({
        status: "error",
        error:
          "None of these are in your cellar, so there is no flight to save yet. Add them to your wishlist below.",
      });
      return;
    }

    setFlightSave({ status: "saving" });
    const response = await saveTastingFlight({
      title: result.title,
      summary: result.summary,
      picks: ownedPicks,
    });
    if (response.error) {
      setFlightSave({ status: "error", error: response.error });
    } else {
      if (missing.length > 0) setExpandedGaps(new Set(missing));
      setFlightSave({ status: "saved", id: response.data.id, missing });
    }
  }

  const gapPicks = result ? result.picks.filter((pick) => !pick.bottle) : [];
  const ownedCount = result ? result.picks.length - gapPicks.length : 0;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          rows={3}
          placeholder="e.g. grilled salmon with lemon butter, roasted asparagus — or: something exploratory for a rainy Sunday"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {/* Character, Effort and include-outside, collapsed behind one
            disclosure (BACKLOG #24) - three settings that are usually left
            on their defaults were the loudest things on the page. Closed
            unless they already differ from default (see optionsOpen above),
            and the summary keeps their current values legible even while
            closed, the way FilterBar's own summary line does. */}
        <details
          open={optionsOpen}
          onToggle={(event) => setOptionsOpen(event.currentTarget.open)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          <summary className="cursor-pointer px-4 py-2.5 text-sm">
            <span className="font-medium">Options</span>
            <span className="ml-2 text-zinc-500">
              {SUGGESTION_CHARACTERS.find((option) => option.value === character)?.label}
              {" · "}
              {EFFORT_LEVELS.find((option) => option.value === effort)?.label} effort
              {" · "}
              {includeOutside ? "cellar + outside" : "cellar only"}
            </span>
          </summary>

          <div className="flex flex-col gap-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
            {/* Off by default: the point of the feature is what you can open
                tonight. Turning it on lets a wine you don't own be
                recommended on its merits rather than only as an admission
                that nothing in the cellar fits. */}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeOutside}
                onChange={(event) => setIncludeOutside(event.target.checked)}
                className="mt-1"
              />
              <span>
                Include wines not in my cellar
                <span className="block text-xs text-zinc-500">
                  Suggests bottles you&apos;d have to buy when they&apos;d pair
                  better — each one marked &ldquo;Not in your cellar&rdquo; and
                  addable to your wishlist.
                </span>
              </span>
            </label>
            {/* How adventurous the pick should be - a separate question from
                the request itself, since "something with roast chicken" is
                equally well answered by a white Burgundy, a Jura Savagnin or
                a chilled Trousseau, and which one you want depends on the
                evening. Balanced is the default and adds nothing to the
                prompt; it's here as a visible name for leaving it alone. */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Character
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {SUGGESTION_CHARACTERS.map((option) => (
                  <label key={option.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="character"
                      value={option.value}
                      checked={character === option.value}
                      onChange={() => setCharacter(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {/* Only the selected option's hint, rather than four lines of
                  explanation competing with the request box above. */}
              <p className="text-xs text-zinc-500">
                {SUGGESTION_CHARACTERS.find((option) => option.value === character)?.hint}
              </p>
            </fieldset>
            {/* Deliberately the same shape as Character above rather than a
                smaller control: they are two settings you make in the same
                breath, and one of them looking like an afterthought would
                suggest it mattered less. Balanced is what every request did
                before this existed, so leaving it alone changes nothing. */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Effort
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {EFFORT_LEVELS.map((option) => (
                  <label key={option.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="effort"
                      value={option.value}
                      checked={effort === option.value}
                      onChange={() => setEffort(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                {EFFORT_LEVELS.find((option) => option.value === effort)?.hint}
              </p>
            </fieldset>
          </div>
        </details>
        <button type="submit" disabled={loading} className={`self-start ${buttonClass}`}>
          {loading ? <Spinner label="Thinking…" /> : "Get suggestions"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-300 p-3 text-sm text-red-600 dark:border-red-900 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            {/* The name leads; the reasoning sits behind it. A three-
                sentence explanation as the headline meant reading a
                paragraph before you could tell what had been suggested. */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {result.mode === "tasting" ? "Tasting flight" : "Pairing"}
              </p>
              <h2 className="text-lg font-medium">{result.title || "Suggestions"}</h2>
              <details className="text-sm text-zinc-500">
                <summary className="cursor-pointer">Why these</summary>
                <p className="mt-1 max-w-prose">{result.summary}</p>
              </details>
            </div>
            {result.mode === "pairing" &&
              (pairingSave.status === "saved" ? (
                <Link
                  href={`/pairings/${pairingSave.id}`}
                  className="shrink-0 text-sm underline underline-offset-2"
                >
                  View kept pairing →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleSavePairing}
                  disabled={pairingSave.status === "saving"}
                  className="shrink-0 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {pairingSave.status === "saving" ? (
                    <Spinner label="Saving…" />
                  ) : (
                    "Save this pairing"
                  )}
                </button>
              ))}
            {result.mode === "tasting" && (
              <>
                {flightSave.status === "saved" ? (
                  <Link
                    href={`/flights/${flightSave.id}`}
                    className="shrink-0 text-sm underline underline-offset-2"
                  >
                    View saved flight →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveFlight}
                    disabled={flightSave.status === "saving"}
                    className="shrink-0 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {flightSave.status === "saving" ? (
                      <Spinner label="Saving…" />
                    ) : gapPicks.length > 0 && ownedCount > 0 ? (
                      `Save the ${ownedCount} I own`
                    ) : (
                      "Save this flight"
                    )}
                  </button>
                )}
              </>
            )}
          </div>
          {flightSave.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{flightSave.error}</p>
          )}
          {pairingSave.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{pairingSave.error}</p>
          )}
          {/* Said once, because the wines you do not own are kept too -
              there is nothing left out to explain. */}
          {pairingSave.status === "saved" && (
            <p className="text-sm text-zinc-500">
              Saved, with the wines you don&apos;t own as well. Rename it on its
              own page.
            </p>
          )}

          {/* Said before the click as well as after it, so the number on the
              button is not the first you hear of it. */}
          {result.mode === "tasting" &&
            gapPicks.length > 0 &&
            flightSave.status === "idle" && (
              <p className="text-sm text-zinc-500">
                {ownedCount === 0
                  ? "None of these are in your cellar yet, so there is nothing to save as a flight - a flight is a queue of bottles you can open."
                  : `${andList(gapPicks.map((pick) => gapName(pick.gap)))} ${
                      gapPicks.length === 1 ? "is not" : "are not"
                    } in your cellar, so saving covers the ${ownedCount} you own - a flight is a queue of bottles you can open. Add the ${
                      gapPicks.length === 1 ? "other one" : "others"
                    } to your wishlist below.`}
              </p>
            )}

          {flightSave.status === "saved" && flightSave.missing?.length > 0 && (
            <p className="text-sm text-zinc-500">
              Saved without{" "}
              {andList(
                flightSave.missing.map((index) =>
                  gapName(result.picks[index].gap),
                ),
              )}
              , which you do not own yet. The wishlist{" "}
              {flightSave.missing.length === 1 ? "form is" : "forms are"} open
              below.
            </p>
          )}

          {result.picks.map((pick, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              {pick.bottle ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/bottles/${pick.bottle.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {result.mode === "tasting" ? `${index + 1}. ` : ""}
                      {bottleHeader(pick.bottle)}
                      {pick.bottle.type ? ` — ${pick.bottle.type}` : ""}
                    </Link>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
                  {pick.pairingContext && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Paired with {pick.pairingContext}
                      </span>
                      <Link
                        href={`/bottles/${pick.bottle.id}?pairedWith=${encodeURIComponent(pick.pairingContext)}`}
                        className="text-zinc-500 underline underline-offset-2"
                      >
                        Add a tasting note →
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {result.mode === "tasting" ? `${index + 1}. ` : ""}
                      {gapHeader(pick.gap)}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                      Not in your cellar
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {[pick.gap.region, pick.gap.country].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>

                  {savedGapIds.has(index) ? (
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Added to wishlist
                    </p>
                  ) : (
                    <details
                      open={expandedGaps.has(index)}
                      onToggle={(event) => {
                        const { open } = event.currentTarget;
                        setExpandedGaps((prev) => {
                          if (prev.has(index) === open) return prev;
                          const next = new Set(prev);
                          if (open) next.add(index);
                          else next.delete(index);
                          return next;
                        });
                      }}
                    >
                      <summary className="cursor-pointer text-sm underline underline-offset-2">
                        Add to wishlist
                      </summary>
                      <div className="mt-3">
                        <BottleForm
                          action={createBottle.bind(null, "wishlist")}
                          defaultValues={{
                            producer: pick.gap.producer,
                            type: pick.gap.type,
                            region: pick.gap.region,
                            country: pick.gap.country,
                            notes: pick.reason,
                          }}
                          submitLabel="Add to wishlist"
                          idPrefix={`suggest-gap-${index}`}
                          onResult={(result) => {
                            if (result.success) {
                              setSavedGapIds((prev) => new Set(prev).add(index));
                            }
                          }}
                        />
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
