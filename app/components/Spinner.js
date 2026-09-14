// A small "glass swirl" loading indicator - a stylized wine glass with a
// swirling arc of liquid inside, used wherever an async operation (saving,
// researching, scanning, uploading) needs to visibly look active rather
// than static, so it's clear the app is working rather than stuck.
export default function Spinner({ label, className = "h-4 w-4" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <path
          d="M8 5 Q8 25 20 25 Q32 25 32 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
        <line
          x1="20"
          y1="25"
          x2="20"
          y2="33"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
        <line
          x1="13"
          y1="35"
          x2="27"
          y2="35"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d="M11 14a9 7 0 1 1 18 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 20 14"
            to="360 20 14"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}
