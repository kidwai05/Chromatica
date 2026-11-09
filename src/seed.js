// Name -> seed. Pure and deterministic.
//
//   "  Ada   LOVELACE " -> "ada lovelace" -> xmur3 hash -> uint32
//
// Normalization makes casing, extra spaces and composed/decomposed accents
// (e.g. "é" as one code point vs "e" + combining accent) all give one seed.

export function normalizeName(name) {
  return String(name ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

// xmur3 string hash (public domain, by bryc). Returns a generator of uint32s;
// the first value is a well-mixed hash of the whole string.
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function hashString(str) {
  return xmur3(String(str))();
}

export function seedFromName(name) {
  return hashString(normalizeName(name));
}
