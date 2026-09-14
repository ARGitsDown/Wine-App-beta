// The app's mark: a cellar vault with a bunch hanging in it. Drawn as plain
// shapes rather than a glyph or an image asset, so it renders identically
// everywhere ImageResponse runs and there is nothing to host.
//
// Lives here rather than in icon.js because both icon.js (the favicon and
// the manifest icon) and apple-icon.js (the iOS home-screen icon) draw it
// at different sizes, and two hand-kept copies would drift.
export const MARK = "#f4e3c8"; // candlelight
export const GROUND = "#4a1523"; // oxblood

// The mark fills 72% of the tile. The wine-glass icon this replaced sat at
// about 55%, which left it reading smaller than it needed to at every size.
export const MARK_FRACTION = 0.72;

export default function AppMark({ size }) {
  const inner = Math.round(size * MARK_FRACTION);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: GROUND,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 100 100">
        {/* The vault. Round caps so the pillars end softly at the floor. */}
        <path
          d="M18 92 V48 a32 32 0 0 1 64 0 V92"
          fill="none"
          stroke={MARK}
          strokeWidth="8.5"
          strokeLinecap="round"
        />
        <path
          d="M50 44 V34"
          fill="none"
          stroke={MARK}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Six grapes, 3-2-1. Rows are offset rather than stacked square:
            two circles sitting directly above a third reads as a face. */}
        <circle cx="36" cy="53" r="8.5" fill={MARK} />
        <circle cx="50" cy="51" r="8.5" fill={MARK} />
        <circle cx="64" cy="53" r="8.5" fill={MARK} />
        <circle cx="43" cy="66" r="8.5" fill={MARK} />
        <circle cx="57" cy="66" r="8.5" fill={MARK} />
        <circle cx="50" cy="79" r="8.5" fill={MARK} />
      </svg>
    </div>
  );
}
