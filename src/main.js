import { createCanvasController } from "./canvas.js";
import { renderScene } from "./render-canvas.js";
import { buildDemoScene } from "./demo.js";
import { countShapes } from "./scene.js";

const canvas = document.getElementById("art");
const status = document.getElementById("status");

// Generate once; re-render on every resize. Generator and renderer are
// independent: the renderer only ever sees the scene data.
const scene = buildDemoScene();

createCanvasController(canvas, (ctx, viewport) => {
  renderScene(ctx, scene, viewport);
  status.textContent =
    `scene v${scene.version} | ${scene.layers.length} layers, ${countShapes(scene)} shapes` +
    ` | canvas ${viewport.width} x ${viewport.height} px @${viewport.dpr}x`;
});
