// UI state and its URL form. Pure (no DOM), so it is easy to test.
//
//   ?name=Ada+Lovelace&shape=circle&min=20&max=80&density=0.7&palette=triadic&fractal=0
//   ?seed=3254028926            (raw numeric seed instead of a name)
//
// Only values that differ from the defaults are written, keeping links short.
import { DEFAULT_PARAMS, sanitizeParams, recipeFromName, recipeFromSeed } from "./generator.js";
import { parseSeed } from "./seed.js";

export const DEFAULT_NAME = "Ada Lovelace";
export const MAX_NAME_LENGTH = 80;

export function createState() {
  return { mode: "name", name: DEFAULT_NAME, seed: null, params: { ...DEFAULT_PARAMS } };
}

export function stateFromQuery(search) {
  const q = new URLSearchParams(search);
  const state = createState();

  const seed = parseSeed(q.get("seed"));
  if (q.has("name")) {
    state.name = q.get("name").slice(0, MAX_NAME_LENGTH);
  } else if (seed !== null) {
    state.mode = "seed";
    state.seed = seed;
    state.name = "";
  }

  const raw = {};
  if (q.has("shape")) raw.shape = q.get("shape");
  if (q.has("min")) raw.sizeMin = Number(q.get("min"));
  if (q.has("max")) raw.sizeMax = Number(q.get("max"));
  if (q.has("density")) raw.density = Number(q.get("density"));
  if (q.has("palette")) raw.paletteMode = q.get("palette");
  if (q.has("fractal")) raw.fractal = q.get("fractal") !== "0";
  state.params = sanitizeParams(raw);
  return state;
}

export function stateToQuery(state) {
  const q = new URLSearchParams();
  if (state.mode === "seed" && state.seed !== null) q.set("seed", String(state.seed));
  else if (state.name !== DEFAULT_NAME) q.set("name", state.name);

  const p = sanitizeParams(state.params);
  const d = DEFAULT_PARAMS;
  if (p.shape !== d.shape) q.set("shape", p.shape);
  if (p.sizeMin !== d.sizeMin) q.set("min", String(p.sizeMin));
  if (p.sizeMax !== d.sizeMax) q.set("max", String(p.sizeMax));
  if (p.density !== d.density) q.set("density", String(p.density));
  if (p.paletteMode !== d.paletteMode) q.set("palette", p.paletteMode);
  if (!p.fractal) q.set("fractal", "0");
  return q.toString();
}

export function recipeFromState(state) {
  return state.mode === "seed" && state.seed !== null
    ? recipeFromSeed(state.seed, state.params)
    : recipeFromName(state.name, state.params);
}

export function favoriteLabel(state) {
  if (state.mode === "seed") return `Seed ${state.seed}`;
  return state.name.trim() || "(empty name)";
}

// Rebuild UI state from a saved favourite (its label is the name as typed).
export function stateFromFavorite(fav) {
  const { recipe } = fav;
  return recipe.source === "seed"
    ? { mode: "seed", name: "", seed: recipe.seed, params: sanitizeParams(recipe.params) }
    : { mode: "name", name: fav.label, seed: null, params: sanitizeParams(recipe.params) };
}
