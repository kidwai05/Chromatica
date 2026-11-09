// Layouts and geometry helpers. Pure functions: numbers in, points out.
// Nothing here uses Math.random(); scatter uses a Halton sequence so that
// Week 1 output is already deterministic. Week 2 swaps in the seeded PRNG.

const TAU = Math.PI * 2;

// Regular polygon vertices, first vertex pointing "up" when rotation = 0.
export function polygonPoints(x, y, r, sides, rotation = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation - Math.PI / 2 + (i / sides) * TAU;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}

// cols x rows grid of cell centers inside a box. u,v are 0..1 positions.
export function gridLayout({ cols, rows, x = 0, y = 0, width, height }) {
  const cw = width / cols;
  const ch = height / rows;
  const pts = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pts.push({
        x: x + (col + 0.5) * cw,
        y: y + (row + 0.5) * ch,
        col, row,
        u: cols > 1 ? col / (cols - 1) : 0.5,
        v: rows > 1 ? row / (rows - 1) : 0.5,
        index: row * cols + col,
      });
    }
  }
  return pts;
}

// Concentric rings. Ring i has perRing(i) points between innerR and outerR.
// angle is the outward direction, handy for rotating shapes to face out.
export function radialLayout({ cx, cy, rings, innerR, outerR, perRing, offsetPerRing = 0 }) {
  const pts = [];
  let index = 0;
  for (let ring = 0; ring < rings; ring++) {
    const t = rings > 1 ? ring / (rings - 1) : 0;
    const radius = innerR + (outerR - innerR) * t;
    const n = typeof perRing === "function" ? perRing(ring) : perRing;
    for (let k = 0; k < n; k++) {
      const angle = (k / n) * TAU + ring * offsetPerRing;
      pts.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle, radius, ring, t, index: index++,
      });
    }
  }
  return pts;
}

// Van der Corput / Halton value: low-discrepancy number in [0,1).
export function halton(i, base) {
  let f = 1, r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

// count points spread evenly (but not in a grid) over a box.
// Deterministic. `skip` shifts the sequence to get a different pattern.
export function scatterLayout({ count, x = 0, y = 0, width, height, skip = 0 }) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1 + skip;
    pts.push({
      x: x + halton(n, 2) * width,
      y: y + halton(n, 3) * height,
      u: halton(n, 5),
      index: i,
    });
  }
  return pts;
}

// Linear interpolation helpers used by compositions.
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
