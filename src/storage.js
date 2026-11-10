// Favourites: saved recipes in localStorage. Never throws, because storage can
// be missing (private windows, blocked cookies), full, or hold corrupt data.
//
// A saved favourite is { id, label, savedAt, recipe }. The recipe carries the
// algorithm version, so old favourites keep rendering with the generator that
// made them.
import { hashString } from "./seed.js";
import { isValidRecipe } from "./generator.js";

export const FAVORITES_KEY = "chromatica:favorites";
export const MAX_FAVORITES = 60;

// Same recipe -> same id, so saving twice never creates a duplicate.
export function favoriteId(recipe) {
  const p = recipe.params;
  const canonical = JSON.stringify([
    recipe.algorithm, recipe.source, recipe.seed, recipe.text,
    p.shape, p.sizeMin, p.sizeMax, p.density, p.paletteMode, p.fractal,
  ]);
  return hashString(canonical).toString(36);
}

function isValidRecord(r) {
  return (
    !!r && typeof r === "object" &&
    typeof r.id === "string" && typeof r.label === "string" &&
    Number.isFinite(r.savedAt) && isValidRecipe(r.recipe)
  );
}

export function createFavoritesStore(storage, now = () => Date.now()) {
  function read() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(FAVORITES_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter(isValidRecord) : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    if (!storage) return false;
    try {
      storage.setItem(FAVORITES_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  return {
    available: !!storage,
    list: read,

    // label: what to show in the list (the name as typed, or "Seed 123").
    add(recipe, label) {
      const id = favoriteId(recipe);
      const record = { id, label: String(label).slice(0, 80), savedAt: now(), recipe };
      const rest = read().filter((r) => r.id !== id);
      const list = [record, ...rest].slice(0, MAX_FAVORITES);
      return { ok: write(list), list, record };
    },

    remove(id) {
      const list = read().filter((r) => r.id !== id);
      return { ok: write(list), list };
    },

    clear() {
      return { ok: write([]), list: [] };
    },
  };
}
