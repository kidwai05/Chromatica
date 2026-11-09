// Seeded random numbers. Math.random() is never used for generation.
import { hashString } from "./seed.js";

// mulberry32: tiny, fast, good-quality 32-bit PRNG. Returns floats in [0, 1).
export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  const s = seed >>> 0;
  const raw = mulberry32(s);
  const rng = {
    seed: s,
    next: raw,
    range: (a, b) => a + (b - a) * raw(),          // float in [a, b)
    int: (a, b) => a + Math.floor(raw() * (b - a + 1)), // integer in [a, b]
    pick: (arr) => arr[Math.floor(raw() * arr.length)],
    chance: (p = 0.5) => raw() < p,
    // An independent child stream. It depends only on (seed, label), never on
    // how many numbers this stream has already produced.
    fork: (label) => createRng(hashString(`${s}:${label}`)),
  };
  return rng;
}

export const STREAM_NAMES = ["palette", "layout", "pattern", "signature"];

// One stream per concern, so changing how much one part draws never shifts
// the numbers another part sees.
export function createStreams(seed) {
  const root = createRng(seed);
  return Object.fromEntries(STREAM_NAMES.map((n) => [n, root.fork(n)]));
}
