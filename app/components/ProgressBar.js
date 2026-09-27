// The bar Scan's batch progress, /estimate-windows and Research's bulk run
// each drew independently (BACKLOG #17) - same shape every time (a track,
// a filled portion, an aria-valuenow/max), with only height, fill color
// and transition speed actually differing between them. Parameterized
// rather than three copies: Research's multi-state coloring (stalled/
// running/done) and taller, slower bar are real, deliberate differences,
// not drift to fix - so they're props here, not a fork.
export default function ProgressBar({
  value,
  max,
  label,
  height = "h-1",
  duration = "duration-300",
  barClassName = "bg-zinc-900 dark:bg-zinc-100",
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={`${height} w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${duration} ${barClassName}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
