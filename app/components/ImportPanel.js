"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { commitImport, previewImport } from "@/app/(owner)/import/actions";
import Spinner from "@/app/components/Spinner";

const buttonClass =
  "min-h-11 rounded bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const quietButtonClass =
  "min-h-11 rounded border border-zinc-300 px-4 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

// Choose a file and where it goes, Preview (writes nothing), then Import, then
// an Undo that stays on screen. One form carries the file for both steps; the
// two buttons are two actions on it.
export default function ImportPanel() {
  const [previewState, previewAction, previewing] = useActionState(previewImport, null);
  const [commitState, commitAction, committing] = useActionState(commitImport, null);
  // The file lives in state, not only in the input: a form action resets its
  // form when it finishes, which would empty the file input between Preview
  // and Import. Both steps build their own FormData from this instead.
  const [file, setFile] = useState(null);
  const [, startAction] = useTransition();
  const fileKey = file ? `${file.name}:${file.size}` : null;
  const [destination, setDestination] = useState("inventory");

  const preview = previewState?.preview;
  // A preview describes the file and destination it was made for; changing
  // either leaves it stale and it is hidden until previewed again.
  const fresh = preview && preview.fileKey === fileKey && preview.status === destination;
  const done = commitState?.done;
  const error = (commitState?.error && !done ? commitState.error : null) ?? previewState?.error;

  function submitWith(action) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("destination", destination);
    startAction(() => action(data));
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-lg border border-green-300 p-4 dark:border-green-900">
        <p className="text-sm">
          Imported <strong>{done.count}</strong> wine{done.count === 1 ? "" : "s"} to the {done.destination}. You can
          undo it under Recent imports below.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={done.status === "inventory" ? "/inventory" : "/wishlist"}
            className="flex min-h-11 items-center text-sm underline underline-offset-2"
          >
            View the {done.destination}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitWith(previewAction);
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5 text-sm">
        CSV file
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm">Put them in</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["inventory", "Cellar"],
            ["wishlist", "Wishlist"],
          ].map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${
                destination === value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="destination"
                value={value}
                checked={destination === value}
                onChange={() => setDestination(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={previewing || committing} className={fresh ? quietButtonClass : buttonClass}>
          Preview
        </button>
        {previewing && <Spinner label="Reading…" />}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {fresh && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p>
            <strong>{preview.importable}</strong> wine{preview.importable === 1 ? "" : "s"} ready for the{" "}
            {preview.destination}.
            {preview.duplicates > 0 && ` ${preview.duplicates} already there, skipped.`}
            {preview.skipped > 0 && ` ${preview.skipped} row${preview.skipped === 1 ? "" : "s"} skipped.`}
          </p>
          <p className="text-zinc-500">
            Read from: {preview.mapping.map((m) => `${m.label} from “${m.header}”`).join(" · ")}
          </p>
          {preview.ignored.length > 0 && (
            <p className="text-zinc-500">Not used: {preview.ignored.join(", ")}</p>
          )}
          {preview.sample.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {preview.sample.map((wine, i) => (
                <li key={i}>
                  {[wine.producer, wine.bottling ? `“${wine.bottling}”` : null, wine.vintage]
                    .filter(Boolean)
                    .join(" ")}
                  {wine.quantity > 1 ? ` ×${wine.quantity}` : ""}
                  {wine.place ? ` · ${wine.place}` : ""}
                </li>
              ))}
              {preview.importable > preview.sample.length && (
                <li className="text-zinc-500">and {preview.importable - preview.sample.length} more</li>
              )}
            </ul>
          )}
          {preview.skippedShown.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-zinc-500">Skipped rows</summary>
              <ul className="flex flex-col gap-0.5 text-zinc-500">
                {preview.skippedShown.map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
                {preview.skipped > preview.skippedShown.length && (
                  <li>and {preview.skipped - preview.skippedShown.length} more</li>
                )}
              </ul>
            </details>
          )}
          {preview.warnings > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-amber-800 dark:text-amber-400">
                {preview.warnings} value{preview.warnings === 1 ? "" : "s"} couldn&apos;t be read and will be left blank
              </summary>
              <ul className="flex flex-col gap-0.5 text-zinc-500">
                {preview.warningsShown.map((w, i) => (
                  <li key={i}>
                    Line {w.line}: {w.text}
                  </li>
                ))}
                {preview.warnings > preview.warningsShown.length && (
                  <li>and {preview.warnings - preview.warningsShown.length} more</li>
                )}
              </ul>
            </details>
          )}
          {preview.importable > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-offline-write
                onClick={() => submitWith(commitAction)}
                disabled={committing}
                className={buttonClass}
              >
                Import {preview.importable} wine{preview.importable === 1 ? "" : "s"}
              </button>
              {committing && <Spinner label="Importing…" />}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
