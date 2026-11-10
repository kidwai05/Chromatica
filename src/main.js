import { createCanvasController } from "./canvas.js";
import { renderScene } from "./render-canvas.js";
import { generateFromRecipe } from "./generator.js";
import { countShapes } from "./scene.js";
import { randomName } from "./names.js";
import { parseSeed, MAX_SEED } from "./seed.js";
import { createFavoritesStore } from "./storage.js";
import { exportPng, exportSvg } from "./export.js";
import {
  stateFromQuery, stateToQuery, recipeFromState, favoriteLabel, stateFromFavorite, MAX_NAME_LENGTH,
} from "./state.js";

const $ = (id) => document.getElementById(id);
const canvas = $("art");

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}
const store = createFavoritesStore(safeLocalStorage());

let state = stateFromQuery(location.search);
let scene = generateFromRecipe(recipeFromState(state));
let viewport = { width: 0, height: 0, dpr: 1 };

const controller = createCanvasController(canvas, (ctx, vp) => {
  viewport = vp;
  renderScene(ctx, scene, vp);
  updateStatus();
});

// ---- Readouts ----

let messageTimer = 0;
function showMessage(text, isError = false) {
  const el = $("message");
  el.textContent = text;
  el.classList.toggle("error", isError);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (el.textContent = ""), 3500);
}

function setHint(text, isError = false) {
  const el = $("hint");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function updateStatus() {
  $("status").textContent =
    `seed ${scene.meta.seed} | ${scene.meta.algorithm} | ${scene.meta.palette.mode} palette | ` +
    `${scene.layers.length} layers, ${countShapes(scene)} shapes | ` +
    `canvas ${viewport.width} x ${viewport.height} px @${viewport.dpr}x`;
}

function updateReadouts() {
  const seedInput = $("seed");
  if (document.activeElement !== seedInput) seedInput.value = scene.meta.seed;

  if (state.mode === "seed") {
    setHint("Seed mode: the signature uses the digits of the seed. Type a name to go back.");
  } else if (scene.meta.name) {
    setHint(`normalized: "${scene.meta.name}"`);
  } else {
    setHint("Empty name: using the default seed.");
  }

  $("sizeMin-out").textContent = state.params.sizeMin;
  $("sizeMax-out").textContent = state.params.sizeMax;
  $("density-out").textContent = state.params.density.toFixed(2);
  const f = scene.meta.fractal;
  $("fractal-info").textContent = f ? `(${f.arms} arms, depth ${f.depth})` : "";

  const sw = $("swatches");
  sw.replaceChildren();
  for (const css of [scene.meta.palette.background, ...scene.meta.palette.colors, scene.meta.palette.ink]) {
    const chip = document.createElement("span");
    chip.style.background = css;
    sw.append(chip);
  }
}

// Push the current state into every control (used on load and when opening a favorite).
function syncControls() {
  $("name").value = state.name;
  $("shape").value = state.params.shape;
  $("paletteMode").value = state.params.paletteMode;
  $("sizeMin").value = state.params.sizeMin;
  $("sizeMax").value = state.params.sizeMax;
  $("density").value = state.params.density;
  $("fractal").checked = state.params.fractal;
  $("name").placeholder = state.mode === "seed" ? "Seed mode: type a name to leave it" : "Type a name";
}

function syncUrl() {
  try {
    const q = stateToQuery(state);
    history.replaceState(null, "", q ? `?${q}` : location.pathname);
  } catch { /* file:// or sandboxed frames: the link just will not update */ }
}

// ---- Regeneration ----

function regenerate() {
  try {
    scene = generateFromRecipe(recipeFromState(state));
  } catch (e) {
    showMessage(`Could not generate: ${e.message}`, true);
    return;
  }
  updateReadouts();
  syncUrl();
  controller.resize(); // re-renders through the callback above
}

// Coalesce rapid input events into one regeneration per frame.
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    regenerate();
  });
}

// ---- Seed and name ----

const nameInput = $("name");
nameInput.addEventListener("input", () => {
  state.mode = "name";
  state.seed = null;
  state.name = nameInput.value.slice(0, MAX_NAME_LENGTH);
  nameInput.placeholder = "Type a name";
  schedule();
});

$("random-name").addEventListener("click", () => {
  state.mode = "name";
  state.seed = null;
  state.name = randomName();
  syncControls();
  schedule();
});

const seedInput = $("seed");
function applySeed() {
  const n = parseSeed(seedInput.value);
  if (n === null) {
    setHint(`Seed must be a whole number from 0 to ${MAX_SEED.toLocaleString("en-US")}.`, true);
    return false;
  }
  state.mode = "seed";
  state.seed = n;
  state.name = "";
  syncControls();
  schedule();
  return true;
}
seedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applySeed();
});
seedInput.addEventListener("change", applySeed);
seedInput.addEventListener("blur", () => {
  // Leaving the box with an invalid value restores the real seed.
  if (parseSeed(seedInput.value) === null) {
    seedInput.value = scene.meta.seed;
    updateReadouts();
  }
});

// ---- Style controls ----

$("shape").addEventListener("change", (e) => { state.params.shape = e.target.value; schedule(); });
$("paletteMode").addEventListener("change", (e) => { state.params.paletteMode = e.target.value; schedule(); });
$("fractal").addEventListener("change", (e) => { state.params.fractal = e.target.checked; schedule(); });

const minEl = $("sizeMin");
const maxEl = $("sizeMax");
minEl.addEventListener("input", () => {
  state.params.sizeMin = Number(minEl.value);
  if (state.params.sizeMin > state.params.sizeMax) {
    state.params.sizeMax = state.params.sizeMin;
    maxEl.value = state.params.sizeMax;
  }
  schedule();
});
maxEl.addEventListener("input", () => {
  state.params.sizeMax = Number(maxEl.value);
  if (state.params.sizeMax < state.params.sizeMin) {
    state.params.sizeMin = state.params.sizeMax;
    minEl.value = state.params.sizeMin;
  }
  schedule();
});

$("density").addEventListener("input", (e) => { state.params.density = Number(e.target.value); schedule(); });

// ---- Export ----

$("export-svg").addEventListener("click", () => {
  exportSvg(scene);
  showMessage("SVG downloaded");
});

$("export-png").addEventListener("click", async () => {
  try {
    await exportPng(scene);
    showMessage("PNG downloaded");
  } catch (e) {
    showMessage(`Export failed: ${e.message}`, true);
  }
});

// ---- Favorites ----

function renderFavorites(list) {
  const ul = $("favorites");
  ul.replaceChildren();
  $("favorites-empty").hidden = list.length > 0;

  for (const fav of list) {
    const li = document.createElement("li");

    const load = document.createElement("button");
    load.type = "button";
    load.className = "fav-load";
    load.title = "Open this artwork";
    const label = document.createElement("span");
    label.className = "fav-label";
    label.textContent = fav.label;
    const meta = document.createElement("span");
    meta.className = "fav-meta";
    meta.textContent = `${fav.recipe.algorithm} | seed ${fav.recipe.seed}`;
    load.append(label, meta);
    load.addEventListener("click", () => {
      state = stateFromFavorite(fav);
      syncControls();
      regenerate();
      showMessage(`Opened "${fav.label}"`);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "fav-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${fav.label}`);
    remove.addEventListener("click", () => {
      const res = store.remove(fav.id);
      renderFavorites(res.list);
      if (!res.ok) showMessage("Could not update saved favorites", true);
    });

    li.append(load, remove);
    ul.append(li);
  }
}

$("save-favorite").addEventListener("click", () => {
  if (!store.available) {
    showMessage("Saving is unavailable: this browser is blocking local storage", true);
    return;
  }
  const res = store.add(scene.meta.recipe, favoriteLabel(state));
  renderFavorites(res.list);
  if (res.ok) showMessage("Saved to favorites");
  else showMessage("Could not save: browser storage is full or blocked", true);
});

// ---- Start ----

syncControls();
updateReadouts();
renderFavorites(store.list());
