// The home screen's card icons.
//
// Hand-written SVG paths rather than image assets or an icon library:
// nothing to host, nothing to license, no request per icon, and they
// inherit the surrounding text colour (stroke: currentColor) so one copy
// works in both themes. Every icon shares a 24x24 frame and a 1.5 stroke.
//
// The shapes below are built from a few shared parts rather than drawn one
// at a time, because four of the six contain a bottle and three contain a
// glass. Sharing the geometry is what keeps the set looking like a set: fix
// a shoulder or a stem once and every icon that uses it follows. The
// builders run once at module load, and this module is only ever imported
// by a server component, so none of it reaches the browser.
//
// These were chosen from a contact sheet of ~50 candidates, judged at the
// size they actually render (20px) rather than at the size they are
// pleasant to draw.

const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// --- shared geometry -------------------------------------------------

// Upright bottle centred on cx. Neck and shoulder are proportions of the
// total height, not fixed lengths, so a small bottle inside the cellar arch
// is the same drawing as a large one rather than a collapsed version of it.
function bottle(cx, top, bottom, hw) {
  const h = bottom - top;
  const neck = h * 0.26;
  const shoulder = h * 0.13;
  const nhw = hw * 0.42;
  const r = Math.min(1, hw * 0.45);
  return (
    `M${cx - nhw} ${top} h${nhw * 2} v${neck} l${hw - nhw} ${shoulder} V${bottom - r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} h${-(hw * 2 - r * 2)} a${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `V${top + neck + shoulder} l${hw - nhw} ${-shoulder} z`
  );
}

// Bottle lying down, neck to the left. A bottle on its side loses the one
// feature that makes it recognisable - the shoulder - so that is drawn as a
// curve and the mouth gets a lip. Tapering with a straight diagonal instead
// reads as a lozenge.
function bottleLying(x, cy, len, hh) {
  const nhh = hh * 0.34;
  const neck = len * 0.3;
  const shoulder = len * 0.15;
  const body = len - neck - shoulder;
  const cap = hh * 0.55;
  return (
    `M${x} ${cy - nhh} h${neck} ` +
    `C${x + neck + shoulder * 0.6} ${cy - nhh}, ${x + neck + shoulder * 0.4} ${cy - hh}, ${x + neck + shoulder} ${cy - hh} ` +
    `h${body - cap} a${cap} ${hh} 0 0 1 0 ${hh * 2} h${-(body - cap)} ` +
    `C${x + neck + shoulder * 0.4} ${cy + hh}, ${x + neck + shoulder * 0.6} ${cy + nhh}, ${x + neck} ${cy + nhh} ` +
    `h${-neck} z` +
    `M${x + 1.1} ${cy - nhh}v${nhh * 2}`
  );
}

// Stemmed glass centred on cx: bowl, stem, foot.
function glass(cx, top, bowl, foot, hw) {
  const stemTop = top + bowl + 0.8 * hw;
  return (
    `M${cx - hw} ${top} h${hw * 2} l${-0.2 * hw} ${bowl} ` +
    `a${0.8 * hw} ${0.8 * hw} 0 0 1 ${-1.6 * hw} 0 z` +
    `M${cx} ${stemTop} v${foot - stemTop}` +
    `M${cx - hw * 0.68} ${foot} h${hw * 1.36}`
  );
}

// A corkscrew's worm. Drawn as a coil seen side-on: the front of every loop
// bulges the same way and the back of each loop is hidden, which is what
// separates a screw from a wave. Turns narrow toward the point.
function coil(cx, top, turns, w, pitch, taper = 0.78) {
  let d = "";
  for (let i = 0; i < turns; i++) {
    const y = top + i * pitch;
    const ww = w * Math.pow(taper, i);
    d +=
      `M${cx - ww * 0.42} ${y} C${cx + ww * 1.05} ${y + pitch * 0.1}, ` +
      `${cx + ww * 1.05} ${y + pitch * 0.9}, ${cx - ww * 0.42} ${y + pitch}`;
  }
  return d;
}

// Viewfinder corner brackets, inset by i.
function brackets(i) {
  return [
    `M${i} ${i + 4}V${i + 1.5}A1.5 1.5 0 0 1 ${i + 1.5} ${i}H${i + 4}`,
    `M${24 - i - 4} ${i}h2.5A1.5 1.5 0 0 1 ${24 - i} ${i + 1.5}v2.5`,
    `M${24 - i} ${24 - i - 4}v2.5a1.5 1.5 0 0 1 -1.5 1.5h-2.5`,
    `M${i + 4} ${24 - i}h-2.5A1.5 1.5 0 0 1 ${i} ${24 - i - 1.5}v-2.5`,
  ];
}

function sparkle(cx, cy, r) {
  return (
    `M${cx} ${cy - r} l${r * 0.38} ${r * 0.62} ${r * 0.62} ${r * 0.38} ` +
    `${-r * 0.62} ${r * 0.38} ${-r * 0.38} ${r * 0.62} ` +
    `${-r * 0.38} ${-r * 0.62} ${-r * 0.62} ${-r * 0.38} ` +
    `${r * 0.62} ${-r * 0.38} z`
  );
}

// A cellar vault. The arch is what says "cave" rather than "cupboard".
function vault(y, springLine) {
  return `M4 ${y}V${springLine}a8 8 0 0 1 16 0v${y - springLine}`;
}

// --- the six icons ---------------------------------------------------

const SCAN = [...brackets(2.5), bottle(12, 7, 18, 2)];

const SUGGEST = [
  "M6.5 4.2h11",
  "M12 4.2v2.3",
  coil(12, 6.5, 4, 2.9, 2.5),
  "M11.2 16.5l.8 2.2",
  sparkle(20, 8.4, 1.9),
  sparkle(4.2, 12, 1.3),
];

const INVENTORY = [
  vault(20.5, 11),
  bottle(8, 12, 20.5, 1.5),
  bottle(12, 11.2, 20.5, 1.5),
  bottle(16, 12, 20.5, 1.5),
];

// One tasted, one still to buy - the checkbox states are the list.
const WISHLIST = [
  "M2.6 7.4l1.3 1.4 2.6-2.8",
  "M3 14.4h3.4v3.4H3z",
  bottleLying(9, 8, 13.4, 1.9),
  bottleLying(9, 16, 13.4, 1.9),
];

// Two glasses meeting, with the little marks that say they just touched.
const TASTING_HISTORY = [
  { d: glass(7, 5, 4.4, 19.5, 3.2), transform: "rotate(-16 7 19.5)" },
  { d: glass(17, 5, 4.4, 19.5, 3.2), transform: "rotate(16 17 19.5)" },
  "M11.2 3.6l-.9 1.4M12.8 3.6l.9 1.4M12 3v1.7",
];

// A flight is a sequence, so the icon shows one.
const FLIGHTS = [glass(5, 6, 3.2, 15, 2), glass(12, 6, 3.2, 15, 2), glass(19, 6, 3.2, 15, 2)];

function Icon({ paths, className }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      {paths.map((path, index) =>
        typeof path === "string" ? (
          <path key={index} d={path} />
        ) : (
          <path key={index} d={path.d} transform={path.transform} />
        )
      )}
    </svg>
  );
}

// Named for the thing each one stands for, not the shape it happens to
// draw: a wishlist icon that stopped being a heart shouldn't still be
// called HeartIcon.
export function ScanIcon({ className = "h-6 w-6" }) {
  return <Icon paths={SCAN} className={className} />;
}

export function SuggestIcon({ className = "h-6 w-6" }) {
  return <Icon paths={SUGGEST} className={className} />;
}

export function InventoryIcon({ className = "h-6 w-6" }) {
  return <Icon paths={INVENTORY} className={className} />;
}

export function WishlistIcon({ className = "h-6 w-6" }) {
  return <Icon paths={WISHLIST} className={className} />;
}

export function TastingHistoryIcon({ className = "h-6 w-6" }) {
  return <Icon paths={TASTING_HISTORY} className={className} />;
}

export function FlightsIcon({ className = "h-6 w-6" }) {
  return <Icon paths={FLIGHTS} className={className} />;
}
