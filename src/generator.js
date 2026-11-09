// The generator: (name, params) -> scene description. No drawing happens here.
//
// Rules that keep output reproducible and stable:
//  * Every random value comes from a seeded stream derived from the name.
//  * Each layer forks its own sub-stream, so layers never disturb each other.
//  * Each element draws the same number of values whatever the parameters are,
//    so e.g. changing the shape type keeps every position unchanged.
import { createScene, addLayer, circle, rect, polygon, line } from "./scene.js";
import { seedFromName, normalizeName } from "./seed.js";
import { createStreams } from "./prng.js";
import { generatePalette, PALETTE_MODES, PALETTE_SIZE } from "./palette.js";
import { signatureMotif } from "./signature.js";
import { gridLayout, radialLayout, lerp, clamp } from "./geometry.js";

const TAU = Math.PI * 2;

export const SHAPE_CHOICES = ["mixed", "circle", "rect", "polygon"];

export const DEFAULT_PARAMS = Object.freeze({
  shape: "mixed",
  sizeMin: 14,
  sizeMax: 60,
  density: 0.5,
  paletteMode: "auto",
});

export function sanitizeParams(input = {}) {
  const p = { ...DEFAULT_PARAMS, ...input };
  const sizeMin = clamp(Number(p.sizeMin) || DEFAULT_PARAMS.sizeMin, 4, 200);
  const sizeMax = clamp(Number(p.sizeMax) || DEFAULT_PARAMS.sizeMax, sizeMin, 240);
  return {
    shape: SHAPE_CHOICES.includes(p.shape) ? p.shape : "mixed",
    sizeMin,
    sizeMax,
    density: clamp(Number.isFinite(Number(p.density)) ? Number(p.density) : 0.5, 0, 1),
    paletteMode: PALETTE_MODES.includes(p.paletteMode) ? p.paletteMode : "auto",
  };
}

// u in [0,1) decides the kind in "mixed" mode and the polygon side count.
function makeShape(kind, u, x, y, size, rotation, style) {
  const k = kind === "mixed" ? ["circle", "rect", "polygon"][Math.floor(u * 3)] : kind;
  if (k === "circle") return circle(x, y, size / 2, style);
  if (k === "rect") return rect(x, y, size, size, rotation, style);
  const sides = 3 + Math.floor(((u * 97.13) % 1) * 6);
  return polygon(x, y, size / 2, sides, rotation, style);
}

export function generateScene(name, params) {
  const p = sanitizeParams(params);
  const seed = seedFromName(name);
  const streams = createStreams(seed);
  const palette = generatePalette(streams.palette, p.paletteMode);
  const color = (i) => palette.colors[i % PALETTE_SIZE].css;

  const scene = createScene({ size: 1000, background: palette.background });
  scene.meta = {
    name: normalizeName(name),
    seed,
    params: p,
    palette: {
      mode: palette.mode,
      baseHue: palette.baseHue,
      dark: palette.dark,
      colors: palette.colors.map((c) => c.css),
      background: palette.background,
      ink: palette.ink,
    },
  };

  // Layer 1: jittered grid texture.
  {
    const rng = streams.layout.fork("texture");
    const layer = addLayer(scene, "texture");
    const cols = Math.round(lerp(5, 13, p.density));
    const cell = 1000 / cols;
    for (const c of gridLayout({ cols, rows: cols, width: 1000, height: 1000 })) {
      const u = rng.next();
      const jx = rng.range(-0.25, 0.25) * cell;
      const jy = rng.range(-0.25, 0.25) * cell;
      const size = lerp(p.sizeMin, p.sizeMax, rng.next());
      const rot = rng.range(0, TAU);
      const ci = rng.int(0, PALETTE_SIZE - 1);
      const opacity = rng.range(0.15, 0.35);
      layer.shapes.push(makeShape(p.shape, u, c.x + jx, c.y + jy, size, rot, { fill: color(ci), opacity }));
    }
  }

  // Layer 2: scattered shapes.
  {
    const rng = streams.layout.fork("scatter");
    const layer = addLayer(scene, "scatter");
    const count = Math.round(lerp(25, 150, p.density));
    for (let i = 0; i < count; i++) {
      const x = rng.range(20, 980);
      const y = rng.range(20, 980);
      const u = rng.next();
      const size = lerp(p.sizeMin * 0.3, p.sizeMax * 0.5, rng.next());
      const rot = rng.range(0, TAU);
      const ci = rng.int(0, PALETTE_SIZE - 1);
      const opacity = rng.range(0.45, 0.75);
      layer.shapes.push(makeShape(p.shape, u, x, y, size, rot, { fill: color(ci), opacity }));
    }
  }

  // Layers 3 and 4: concentric rings of shapes, joined by a web of lines.
  {
    const rng = streams.pattern.fork("rings");
    const ringCount = rng.int(3, 5);
    const base = rng.int(5, 8);
    const step = rng.int(4, 6);
    const twist = rng.range(0.1, 0.6);
    const colorShift = rng.int(0, PALETTE_SIZE - 1);
    const pts = radialLayout({
      cx: 500, cy: 500, rings: ringCount, innerR: 90, outerR: 235,
      perRing: (r) => base + r * step, offsetPerRing: twist,
    });

    const web = addLayer(scene, "web");
    for (let r = 0; r < ringCount - 1; r++) {
      const a = pts.filter((q) => q.ring === r);
      const b = pts.filter((q) => q.ring === r + 1);
      a.forEach((q, k) => {
        const t = b[Math.round((k / a.length) * b.length) % b.length];
        web.shapes.push(line(q.x, q.y, t.x, t.y, { stroke: palette.ink, strokeWidth: 1.2, opacity: 0.35 }));
      });
    }

    const layer = addLayer(scene, "rings");
    for (const q of pts) {
      const u = rng.next();
      const jitter = rng.next();
      const mix = clamp(1 - q.t * 0.7 + (jitter - 0.5) * 0.3, 0, 1);
      const size = lerp(p.sizeMin, p.sizeMax * 0.7, mix);
      layer.shapes.push(
        makeShape(p.shape, u, q.x, q.y, size, q.angle + Math.PI / 2, {
          fill: color(q.ring + colorShift), stroke: palette.ink, strokeWidth: 1.5, opacity: 0.92,
        }),
      );
    }
  }

  // Layer 5: the name signature, one polygon per letter on a ring.
  {
    const layer = addLayer(scene, "signature");
    const motif = signatureMotif(name);
    if (motif.length) {
      layer.shapes.push(circle(500, 500, 340, { stroke: palette.ink, strokeWidth: 1.5, opacity: 0.55 }));
    }
    for (const m of motif) {
      layer.shapes.push(
        polygon(m.x, m.y, m.r, m.sides, m.rotation, {
          fill: color(m.colorIndex), stroke: palette.ink, strokeWidth: 2.5, opacity: 1,
        }),
      );
    }
  }

  // Layer 6: focal element.
  {
    const rng = streams.pattern.fork("focus");
    const sides = rng.int(5, 9);
    const rot = rng.range(0, TAU);
    const layer = addLayer(scene, "focus");
    layer.shapes.push(circle(500, 500, 46, { fill: palette.background, stroke: palette.ink, strokeWidth: 3 }));
    layer.shapes.push(polygon(500, 500, 30, sides, rot, { fill: color(0) }));
    layer.shapes.push(circle(500, 500, 9, { fill: palette.background }));
  }

  return scene;
}
