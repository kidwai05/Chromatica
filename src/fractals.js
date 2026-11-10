// Fractal-inspired patterns. Pure geometry: numbers in, segments out.
//
// treeSegments grows `arms` recursive binary trees outward from a centre.
// Every branch splits into two children, each `ratio` times as long, turned by
// +/- `spread` radians (plus a small `twist` for asymmetry). Segment lengths
// are scaled so the straight-line path to the tips totals exactly `reach`, so
// the pattern always fits inside a known radius whatever the depth is.
const TAU = Math.PI * 2;

export function segmentCount(arms, depth) {
  return arms * (2 ** (depth + 1) - 1);
}

export function treeSegments({
  cx = 500,
  cy = 500,
  arms,
  depth,
  reach,
  innerR = 0,
  ratio = 0.72,
  spread = 0.5,
  twist = 0,
  startAngle = -Math.PI / 2,
}) {
  const out = [];
  const extent = reach - innerR;
  // Sum of a geometric series over levels 0..depth.
  const firstLength = (extent * (1 - ratio)) / (1 - ratio ** (depth + 1));

  function grow(x, y, angle, length, level) {
    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    out.push({ x1: x, y1: y, x2, y2, depth: level });
    if (level < depth) {
      grow(x2, y2, angle - spread + twist, length * ratio, level + 1);
      grow(x2, y2, angle + spread + twist, length * ratio, level + 1);
    }
  }

  for (let a = 0; a < arms; a++) {
    const angle = startAngle + (a / arms) * TAU;
    grow(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR, angle, firstLength, 0);
  }
  return out;
}
