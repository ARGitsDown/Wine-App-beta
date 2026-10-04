import { decisionCounts, progressParts } from "@/lib/pairings";

// How far along the choices are, for a pairing: one line on the list and on
// the pairing's own page. The wording (and why it changes with the plan) is
// in progressParts; the Drink count wears the Tasted colour.
export default function PairingProgress({ picks, planned, className = "text-xs" }) {
  const parts = progressParts(decisionCounts(picks), planned);
  return (
    <p className={`${className} text-zinc-500`}>
      {parts.map((part, index) => (
        <span key={part.text}>
          {index > 0 && " · "}
          <span className={part.strong ? "font-medium text-sky-700 dark:text-sky-400" : ""}>
            {part.text}
          </span>
        </span>
      ))}
    </p>
  );
}
