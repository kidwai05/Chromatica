import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { normalizeName, seedFromName, hashString } from "../src/seed.js";
import { createRng, createStreams } from "../src/prng.js";
import { generatePalette, PALETTE_MODES } from "../src/palette.js";
import { signatureMotif, signatureLetters, MAX_LETTERS } from "../src/signature.js";
import { generateScene, sanitizeParams, DEFAULT_PARAMS } from "../src/generator.js";
import { renderScene } from "../src/render-canvas.js";
import { countShapes } from "../src/scene.js";

const first = (rng, n) => Array.from({ length: n }, () => rng.next());
const angleDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180); // 0..180

// ---------- M2.1 seed + PRNG ----------

test("same name gives the same first 100 numbers", () => {
  const a = first(createRng(seedFromName("Ada Lovelace")), 100);
  const b = first(createRng(seedFromName("Ada Lovelace")), 100);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 100);
});

test("normalization: case, spacing and accents map to one seed", () => {
  const s = seedFromName("Ada Lovelace");
  assert.equal(seedFromName("  ADA   lovelace\t"), s);
  assert.equal(seedFromName("ada lovelace") === s, true); // NBSP counts as whitespace
  assert.equal(seedFromName("José"), seedFromName("José")); // NFC vs NFD
  assert.equal(normalizeName(null), "");
});

test("different names give different seeds and different numbers", () => {
  const names = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "ada", "adb", ""];
  const seeds = names.map(seedFromName);
  assert.equal(new Set(seeds).size, names.length);
  assert.notDeepEqual(first(createRng(seeds[0]), 10), first(createRng(seeds[1]), 10));
});

test("pinned values: the v1 algorithm must not change silently", () => {
  assert.equal(seedFromName("Ada Lovelace"), 3254028926);
  assert.equal(seedFromName(""), 167010153);
  assert.equal(createRng(3254028926).next(), 0.26458907406777143);
});

test("rng helpers stay in range", () => {
  const rng = createRng(42);
  for (let i = 0; i < 2000; i++) {
    const f = rng.range(-3, 7);
    assert.ok(f >= -3 && f < 7);
    const n = rng.int(2, 5);
    assert.ok(Number.isInteger(n) && n >= 2 && n <= 5);
  }
  assert.ok(["a", "b", "c"].includes(rng.pick(["a", "b", "c"])));
});

test("rng output is roughly uniform", () => {
  const rng = createRng(seedFromName("uniformity"));
  const buckets = new Array(10).fill(0);
  const N = 20000;
  for (let i = 0; i < N; i++) buckets[Math.floor(rng.next() * 10)]++;
  for (const b of buckets) assert.ok(b > N / 10 * 0.9 && b < N / 10 * 1.1, `bucket ${b}`);
});

// ---------- M2.2 streams ----------

test("fork depends only on (seed, label), not on prior draws", () => {
  const a = createRng(99);
  const b = createRng(99);
  first(b, 500); // consume b heavily
  assert.deepEqual(first(a.fork("x"), 20), first(b.fork("x"), 20));
  assert.notDeepEqual(first(a.fork("x"), 5), first(a.fork("y"), 5));
});

test("streams are independent: draining one does not move another", () => {
  const s1 = createStreams(2024);
  const s2 = createStreams(2024);
  first(s2.palette, 10000);
  first(s2.pattern, 777);
  assert.deepEqual(first(s1.layout, 50), first(s2.layout, 50));
  assert.equal(new Set(Object.values(s1).map((r) => r.seed)).size, 4);
});

// ---------- M2.3 palettes ----------

test("palette is deterministic and has 5 colours", () => {
  const a = generatePalette(createRng(5));
  const b = generatePalette(createRng(5));
  assert.deepEqual(a, b);
  assert.equal(a.colors.length, 5);
  for (const c of a.colors) assert.match(c.css, /^hsl\(\d+\.\d, \d+\.\d%, \d+\.\d%\)$/);
});

test("hue relationships: complementary, analogous, triadic", () => {
  const comp = generatePalette(createRng(7), "complementary");
  assert.ok(Math.abs(angleDiff(comp.colors[2].h, comp.colors[0].h) - 180) < 1e-9);

  const ana = generatePalette(createRng(7), "analogous");
  for (const c of ana.colors) assert.ok(angleDiff(c.h, ana.baseHue) <= 36 + 1e-9);

  const tri = generatePalette(createRng(7), "triadic");
  assert.ok(Math.abs(angleDiff(tri.colors[1].h, tri.colors[0].h) - 120) < 1e-9);
  assert.ok(Math.abs(angleDiff(tri.colors[2].h, tri.colors[1].h) - 120) < 1e-9);
});

test("switching palette mode keeps base hue, lightness and background", () => {
  const [a, b] = ["complementary", "triadic"].map((m) => generatePalette(createRng(11), m));
  assert.equal(a.baseHue, b.baseHue);
  assert.equal(a.background, b.background);
  assert.deepEqual(a.colors.map((c) => c.l), b.colors.map((c) => c.l));
});

test("auto mode produces every mode across many seeds", () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(generatePalette(createRng(hashString(`s${i}`))).mode);
  assert.deepEqual([...seen].sort(), [...PALETTE_MODES].sort());
});

// ---------- M2.4 signature ----------

test("signature: deterministic, name-specific, normalization-safe", () => {
  assert.deepEqual(signatureMotif("Ada Lovelace"), signatureMotif("  ada   LOVELACE"));
  assert.notDeepEqual(signatureMotif("Ada Lovelace"), signatureMotif("Grace Hopper"));
  assert.equal(signatureMotif("Ada Lovelace").length, 11); // spaces skipped
  assert.deepEqual(signatureMotif(""), []);
});

test("signature: same letter, same shape; long names are capped; stays in bounds", () => {
  const m = signatureMotif("aaaa");
  assert.ok(m.every((s) => s.sides === m[0].sides && s.r === m[0].r && s.colorIndex === m[0].colorIndex));
  assert.equal(signatureLetters("x".repeat(500)).length, MAX_LETTERS);
  for (const s of signatureMotif("Wolfeschlegelsteinhausenbergerdorff Wolfeschlegelstein")) {
    assert.ok(s.x - s.r >= 0 && s.x + s.r <= 1000 && s.y - s.r >= 0 && s.y + s.r <= 1000);
  }
});

// ---------- M2.5 generator + params ----------

test("generateScene: identical for the same name and params", () => {
  assert.deepEqual(generateScene("Ada Lovelace"), generateScene("Ada Lovelace"));
  assert.deepEqual(generateScene("Ada Lovelace"), generateScene("  ADA lovelace "));
});

test("generateScene: different names look different", () => {
  const a = generateScene("Ada Lovelace");
  const b = generateScene("Grace Hopper");
  assert.notDeepEqual(a.layers, b.layers);
  assert.notEqual(a.meta.seed, b.meta.seed);
});

test("scene is plain JSON with finite numbers, in bounds, 6 layers", () => {
  for (const name of ["Ada Lovelace", "", "🎨 Ünïcode", "x".repeat(500), "李小龍"]) {
    const scene = generateScene(name);
    assert.deepEqual(JSON.parse(JSON.stringify(scene)), scene);
    assert.deepEqual(scene.layers.map((l) => l.name), ["texture", "scatter", "web", "rings", "signature", "focus"]);
    for (const l of scene.layers) for (const s of l.shapes) {
      for (const [k, v] of Object.entries(s)) if (typeof v === "number") assert.ok(Number.isFinite(v), `${name} ${s.type}.${k}`);
      const x = s.x ?? s.x1, y = s.y ?? s.y1;
      assert.ok(x > -100 && x < 1100 && y > -100 && y < 1100);
    }
  }
});

test("changing shape type keeps every texture/scatter position unchanged", () => {
  const pos = (scene, layer) =>
    scene.layers.find((l) => l.name === layer).shapes.map((s) => [s.x, s.y]);
  const circles = generateScene("Ada Lovelace", { shape: "circle" });
  const squares = generateScene("Ada Lovelace", { shape: "rect" });
  assert.deepEqual(pos(circles, "texture"), pos(squares, "texture"));
  assert.deepEqual(pos(circles, "scatter"), pos(squares, "scatter"));
  assert.ok(circles.layers[0].shapes.every((s) => s.type === "circle"));
  assert.ok(squares.layers[0].shapes.every((s) => s.type === "rect"));
});

test("controls take effect: density, size range, palette mode", () => {
  const lo = generateScene("Ada Lovelace", { density: 0 });
  const hi = generateScene("Ada Lovelace", { density: 1 });
  assert.ok(countShapes(hi) > countShapes(lo));

  const small = generateScene("Ada Lovelace", { shape: "circle", sizeMin: 5, sizeMax: 10 });
  const big = generateScene("Ada Lovelace", { shape: "circle", sizeMin: 80, sizeMax: 120 });
  const maxR = (sc) => Math.max(...sc.layers[0].shapes.map((s) => s.r));
  assert.ok(maxR(small) <= 5 && maxR(big) >= 40);

  for (const m of PALETTE_MODES) assert.equal(generateScene("Ada", { paletteMode: m }).meta.palette.mode, m);
});

test("sanitizeParams repairs bad input", () => {
  const p = sanitizeParams({ shape: "star", sizeMin: 500, sizeMax: 1, density: 9, paletteMode: "neon" });
  assert.equal(p.shape, "mixed");
  assert.equal(p.paletteMode, "auto");
  assert.ok(p.density === 1 && p.sizeMin <= p.sizeMax);
  assert.deepEqual(sanitizeParams(), { ...DEFAULT_PARAMS });
});

test("generated scenes render with a mock context, finite numbers only", () => {
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => {
      for (const a of args) if (typeof a === "number") assert.ok(Number.isFinite(a), `${String(name)} got ${a}`);
    },
    set: () => true,
  });
  renderScene(ctx, generateScene("Ada Lovelace"), { width: 800, height: 600 });
  renderScene(ctx, generateScene(""), { width: 320, height: 640 });
});

test("generation code never calls Math.random", () => {
  for (const f of readdirSync(new URL("../src/", import.meta.url))) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    // Strip comments, then look for real calls.
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!code.includes("Math.random"), `${f} uses Math.random`);
  }
});
