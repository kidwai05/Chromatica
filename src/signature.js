// Name signature: the letters of the name become a visible motif.
//
// One shape per letter, spaced evenly around a ring in name order, starting at
// the top. Each letter's code point decides its shape (sides, size, rotation,
// colour slot), so the same letter always looks the same and different names
// give clearly different crowns. This is a pure function of the name; it uses
// no random numbers.
import { normalizeName } from "./seed.js";

const TAU = Math.PI * 2;

export const MAX_LETTERS = 64;

export function signatureLetters(name) {
  return Array.from(normalizeName(name))
    .filter((ch) => /\S/u.test(ch))
    .slice(0, MAX_LETTERS);
}

export function signatureMotif(name, { cx = 500, cy = 500, radius = 340 } = {}) {
  const letters = signatureLetters(name);
  const n = letters.length;
  return letters.map((letter, i) => {
    const c = letter.codePointAt(0);
    const angle = -Math.PI / 2 + (i / n) * TAU;
    return {
      letter,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 12 + (c % 7) * 3.5,
      sides: 3 + (c % 6),
      rotation: angle + Math.PI / 2 + ((c % 12) / 12) * 0.6,
      colorIndex: c % 5,
    };
  });
}
