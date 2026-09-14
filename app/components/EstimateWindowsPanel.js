"use client";

import { useState } from "react";
import Link from "next/link";
import { estimateDrinkWindows } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

// Chunked client-side so no single server request has to process the
// whole cellar at once - keeps each request well under a serverless
// function's execution limit, and lets the page show live progress
// across what can be a several-minute run at hundreds of bottles.
const BATCH_SIZE = 20;

// A handful of batches in flight at once (same pattern as scan's photo
// processing) so a large cellar's backfill isn't gated on one batch
// finishing before the next starts, while still capping how many
// concurrent estimate requests go out at once.
const CONCURRENCY = 3;

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

export default function EstimateWindowsPanel({ bottles }) {
  const [status, setStatus] = useState("idle"); // idle | running | done
  const [done, setDone] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [failedBatches, setFailedBatches] = useState(0);
  // How many came back from the estimate cache rather than a fresh ask.
  const [reused, setReused] = useState(0);
  // Frozen when the run starts. Finishing gives every bottle a window, so
  // the server's "missing a window" list empties underneath this component
  // - reading the total off the live prop would report "6 of 0".
  const [total, setTotal] = useState(0);

  async function handleStart() {
    setStatus("running");
    setTotal(bottles.length);
    setDone(0);
    setUpdated(0);
    setReused(0);
    setFailedBatches(0);

    const batches = chunk(
      bottles.map((bottle) => bottle.id),
      BATCH_SIZE
    );
    let doneCount = 0;
    let updatedCount = 0;
    let failCount = 0;
    let reusedCount = 0;

    await runWithConcurrency(batches, CONCURRENCY, async (batch) => {
      const result = await estimateDrinkWindows(batch);
      if (result.error) {
        failCount += 1;
        setFailedBatches(failCount);
      } else {
        updatedCount += result.data.updated;
        reusedCount += result.data.fromCache ?? 0;
        setUpdated(updatedCount);
        setReused(reusedCount);
      }
      doneCount += batch.length;
      setDone(doneCount);
    });

    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-green-300 p-4 dark:border-green-900">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ✓ Done — estimated {updated} of {total} bottles.
        </p>
        {reused > 0 && (
          <p className="text-sm text-zinc-500">
            {reused} reused an estimate already on file for the same wine,
            so only {updated - reused} needed asking.
          </p>
        )}
        {failedBatches > 0 && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {failedBatches} batch{failedBatches === 1 ? "" : "es"} failed —
            reload this page to retry just the bottles still missing a
            window.
          </p>
        )}
        <Link href="/inventory" className="text-sm underline underline-offset-2">
          Back to Inventory →
        </Link>
      </div>
    );
  }

  if (bottles.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Every inventory bottle already has a drinking window.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {bottles.length} bottle{bottles.length === 1 ? "" : "s"} currently
        missing a drinking window.
      </p>
      {status === "running" ? (
        <div className="text-sm text-zinc-500">
          <Spinner label={`Estimating… ${done} of ${total}`} />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          className="self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start estimating
        </button>
      )}
    </div>
  );
}
