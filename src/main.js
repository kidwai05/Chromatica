import { createCanvasController } from "./canvas.js";
import { renderScene } from "./render-canvas.js";
import { generateScene, DEFAULT_PARAMS } from "./generator.js";
import { countShapes } from "./scene.js";
import { randomName } from "./names.js";

const $ = (id) => document.getElementById(id);
const canvas = $("art");

// ?name=Ada%20Lovelace pre-fills the name (handy for sharing and screenshots).
const initialName = new URLSearchParams(location.search).get("name") ?? "Ada Lovelace";

const state = { name: initialName, params: { ...DEFAULT_PARAMS } };
let scene = generateScene(state.name, state.params);
let viewport = { width: 0, height: 0, dpr: 1 };

const controller = createCanvasController(canvas, (ctx, vp) => {
  viewport = vp;
  renderScene(ctx, scene, vp);
  updateStatus();
});

function updateStatus() {
  $("status").textContent =
    `seed ${scene.meta.seed} | ${scene.meta.palette.mode} palette | ` +
    `${scene.layers.length} layers, ${countShapes(scene)} shapes | ` +
    `canvas ${viewport.width} x ${viewport.height} px @${viewport.dpr}x`;
}

function updateReadouts() {
  $("seed").textContent = scene.meta.seed;
  $("norm").textContent = scene.meta.name ? `normalized: "${scene.meta.name}"` : "Empty name: using the default seed.";
  $("sizeMin-out").textContent = state.params.sizeMin;
  $("sizeMax-out").textContent = state.params.sizeMax;
  $("density-out").textContent = state.params.density.toFixed(2);

  const sw = $("swatches");
  sw.replaceChildren();
  for (const css of [scene.meta.palette.background, ...scene.meta.palette.colors, scene.meta.palette.ink]) {
    const chip = document.createElement("span");
    chip.style.background = css;
    sw.append(chip);
  }
}

function regenerate() {
  scene = generateScene(state.name, state.params);
  updateReadouts();
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

// ---- Wire up controls ----
const nameInput = $("name");
nameInput.value = state.name;
nameInput.addEventListener("input", () => {
  state.name = nameInput.value;
  schedule();
});

$("random-name").addEventListener("click", () => {
  state.name = randomName();
  nameInput.value = state.name;
  schedule();
});

$("shape").addEventListener("change", (e) => {
  state.params.shape = e.target.value;
  schedule();
});

$("paletteMode").addEventListener("change", (e) => {
  state.params.paletteMode = e.target.value;
  schedule();
});

const minEl = $("sizeMin");
const maxEl = $("sizeMax");
minEl.value = state.params.sizeMin;
maxEl.value = state.params.sizeMax;

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

const densityEl = $("density");
densityEl.value = state.params.density;
densityEl.addEventListener("input", () => {
  state.params.density = Number(densityEl.value);
  schedule();
});

updateReadouts();
