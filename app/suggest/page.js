"use client";

import { useState } from "react";
import Link from "next/link";
import { createBottle, getSuggestions, saveTastingFlight } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import Spinner from "@/app/components/Spinner";

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

export default function SuggestPage() {
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [savedGapIds, setSavedGapIds] = useState(new Set());
  const [flightSave, setFlightSave] = useState({ status: "idle" });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!request.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setFlightSave({ status: "idle" });

    const response = await getSuggestions(request);
    if (response.error) {
      setError(response.error);
    } else {
      setResult(response.data);
    }
    setLoading(false);
  }

  async function handleSaveFlight() {
    setFlightSave({ status: "saving" });
    const ownedPicks = result.picks
      .filter((pick) => pick.bottle)
      .map((pick) => ({ bottleId: pick.bottle.id, reason: pick.reason }));
    const response = await saveTastingFlight(result.summary, ownedPicks);
    if (response.error) {
      setFlightSave({ status: "error", error: response.error });
    } else {
      setFlightSave({ status: "saved", id: response.data.id });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Suggest</h1>
        <p className="text-sm text-zinc-500">
          Describe tonight&apos;s menu for a pairing, or a theme/mood for a
          tasting flight. Claude looks through your current inventory (not
          your wishlist) and figures out which one you mean.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          rows={3}
          placeholder="e.g. grilled salmon with lemon butter, roasted asparagus — or: something exploratory for a rainy Sunday"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" disabled={loading} className={buttonClass}>
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
            <div>
              <h2 className="font-medium">
                {result.mode === "tasting" ? "Tasting flight" : "Pairing suggestions"}
              </h2>
              <p className="text-sm text-zinc-500">{result.summary}</p>
            </div>
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
                        Log this pairing →
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {result.mode === "tasting" ? `${index + 1}. ` : ""}
                      {[pick.gap.producer, pick.gap.type].filter(Boolean).join(" — ")}
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
                    <details>
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
