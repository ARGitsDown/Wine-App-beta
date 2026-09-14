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
        <ellipse cx="20" cy="15" ry="3.2" fill="#7b1329">
          <animate
            attributeName="rx"
            values="9;1.5;9"
            keyTimes="0;0.5;1"
            dur="1.1s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.9;0.5;0.9"
            keyTimes="0;0.5;1"
            dur="1.1s"
            repeatCount="indefinite"
          />
        </ellipse>
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}
