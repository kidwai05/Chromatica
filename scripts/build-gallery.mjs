// Writes a gallery of SVGs for famous names into docs/gallery/.
// Run with: npm run gallery
// Uses the same SVG exporter as the app, so the files match the exports.
import { mkdirSync, writeFileSync } from "node:fs";
import { generateScene } from "../src/generator.js";
import { sceneToSvg } from "../src/render-svg.js";
import { exportTitle, slugify } from "../src/export.js";

const NAMES = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "Katherine Johnson",
  "Margaret Hamilton",
  "Claude Shannon",
];

const outDir = new URL("../docs/gallery/", import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const name of NAMES) {
  const scene = generateScene(name);
  const file = `${slugify(name)}.svg`;
  writeFileSync(new URL(file, outDir), sceneToSvg(scene, { title: exportTitle(scene) }));
  console.log(`${file}  seed ${scene.meta.seed}  ${scene.meta.palette.mode}  fractal depth ${scene.meta.fractal.depth}`);
}
