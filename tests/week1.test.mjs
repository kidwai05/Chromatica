import test from "node:test";
import assert from "node:assert/strict";
import { gridLayout, radialLayout, scatterLayout, polygonPoints, halton } from "../src/geometry.js";
import { createScene, addLayer, circle, rect, polygon, line, countShapes } from "../src/scene.js";
import { buildDemoScene } from "../src/demo.js";
import { renderScene, fitScene } from "../src/render-canvas.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("grid: count, bounds, row-major index", () => {
  const pts = gridLayout({ cols: 4, rows: 3, x: 10, y: 20, width: 400, height: 300 });
  assert.equal(pts.length, 12);
  close(pts[0].x, 10 + 50);
  close(pts[0].y, 20 + 50);
  assert.equal(pts[5].col, 1);
  assert.equal(pts[5].row, 1);
  for (const p of pts) {
    assert.ok(p.x > 10 && p.x < 410 && p.y > 20 && p.y < 320);
  }
});

test("radial: points sit on their ring radius", () => {
  const pts = radialLayout({ cx: 100, cy: 100, rings: 3, innerR: 10, outerR: 50, perRing: (r) => 4 + r });
  assert.equal(pts.length, 4 + 5 + 6);
  for (const p of pts) close(Math.hypot(p.x - 100, p.y - 100), p.radius);
});

test("scatter: deterministic, in bounds, no repeats", () => {
  const a = scatterLayout({ count: 50, x: 5, y: 5, width: 100, height: 100 });
  const b = scatterLayout({ count: 50, x: 5, y: 5, width: 100, height: 100 });
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((p) => `${p.x},${p.y}`)).size, 50);
  for (const p of a) assert.ok(p.x >= 5 && p.x < 105 && p.y >= 5 && p.y < 105);
  assert.notDeepEqual(a, scatterLayout({ count: 50, x: 5, y: 5, width: 100, height: 100, skip: 7 }));
});

test("halton known values", () => {
  close(halton(1, 2), 0.5);
  close(halton(2, 2), 0.25);
  close(halton(3, 2), 0.75);
  close(halton(1, 3), 1 / 3);
});

test("polygon: vertex count and equal radius", () => {
  const pts = polygonPoints(0, 0, 10, 5, 0.3);
  assert.equal(pts.length, 5);
  for (const p of pts) close(Math.hypot(p.x, p.y), 10);
  close(polygonPoints(0, 0, 10, 4, 0)[0].y, -10); // first vertex points up
});

test("scene: shape constructors and layers", () => {
  const s = createScene();
  const l = addLayer(s, "a");
  l.shapes.push(circle(1, 2, 3), rect(0, 0, 4, 5), polygon(0, 0, 5, 6), line(0, 0, 1, 1));
  assert.equal(countShapes(s), 4);
  assert.deepEqual(l.shapes.map((x) => x.type), ["circle", "rect", "polygon", "line"]);
  assert.equal(l.shapes[0].opacity, 1);
});

test("demo scene is plain JSON data and identical on every build", () => {
  const a = buildDemoScene();
  const b = buildDemoScene();
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a); // no functions, no NaN
  assert.ok(countShapes(a) > 200);
});

test("fitScene letterboxes a square scene", () => {
  const f = fitScene({ size: 1000 }, 800, 500);
  close(f.scale, 0.5);
  close(f.offsetX, 150);
  close(f.offsetY, 0);
});

test("renderer: draws the demo scene with a mock context, finite numbers only", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => {
      for (const a of args) if (typeof a === "number") assert.ok(Number.isFinite(a), `${String(name)} got ${a}`);
      calls.push(String(name));
    },
    set: () => true,
  });
  renderScene(ctx, buildDemoScene(), { width: 900, height: 700 });
  assert.ok(calls.includes("arc") && calls.includes("rect") && calls.includes("lineTo") && calls.includes("moveTo"));
});
