// Hardcoded composition for Week 1. This is the "generator" side: it only
// builds scene data. Week 2 replaces the constants below with seeded values.
import { createScene, addLayer, circle, rect, polygon, line } from "./scene.js";
import { gridLayout, radialLayout, scatterLayout, lerp } from "./geometry.js";

const PALETTE = ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"];
const at = (t) => PALETTE[Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length))];

export function buildDemoScene() {
  const scene = createScene({ size: 1000, background: "#f6f1e7" });

  // Layer 1: grid of squares whose size and tilt vary across the grid.
  const grid = addLayer(scene, "grid");
  for (const p of gridLayout({ cols: 10, rows: 10, x: 0, y: 0, width: 1000, height: 1000 })) {
    const size = lerp(22, 70, (p.u + p.v) / 2);
    grid.shapes.push(
      rect(p.x, p.y, size, size, (p.u - p.v) * 0.8, { fill: at((p.u + p.v) / 2), opacity: 0.22 }),
    );
  }

  // Layer 2: scattered dots, the loose texture.
  const dots = addLayer(scene, "scatter");
  for (const p of scatterLayout({ count: 90, x: 20, y: 20, width: 960, height: 960 })) {
    dots.shapes.push(circle(p.x, p.y, lerp(3, 11, p.u), { fill: at(p.u), opacity: 0.55 }));
  }

  // Layer 3: radial web of lines joining the two outer rings.
  const web = addLayer(scene, "web");
  const ringA = radialLayout({ cx: 500, cy: 500, rings: 1, innerR: 300, outerR: 300, perRing: 24 });
  const ringB = radialLayout({ cx: 500, cy: 500, rings: 1, innerR: 180, outerR: 180, perRing: 24, offsetPerRing: Math.PI / 24 });
  ringA.forEach((a, i) => {
    const b = ringB[i];
    const c = ringB[(i + 1) % ringB.length];
    web.shapes.push(line(a.x, a.y, b.x, b.y, { stroke: "#264653", strokeWidth: 1.2, opacity: 0.6 }));
    web.shapes.push(line(a.x, a.y, c.x, c.y, { stroke: "#264653", strokeWidth: 1.2, opacity: 0.6 }));
  });

  // Layer 4: concentric polygon rings, facing outward.
  const rings = addLayer(scene, "rings");
  for (const p of radialLayout({
    cx: 500, cy: 500, rings: 4, innerR: 70, outerR: 250,
    perRing: (r) => 6 + r * 6, offsetPerRing: 0.35,
  })) {
    rings.shapes.push(
      polygon(p.x, p.y, lerp(26, 12, p.t), 3 + (p.ring % 4), p.angle + Math.PI / 2, {
        fill: at(p.t), stroke: "#1b2a30", strokeWidth: 1.5, opacity: 0.9,
      }),
    );
  }

  // Layer 5: focal element in the center.
  const focus = addLayer(scene, "focus");
  focus.shapes.push(circle(500, 500, 46, { fill: "#f6f1e7", stroke: "#1b2a30", strokeWidth: 3 }));
  focus.shapes.push(polygon(500, 500, 30, 8, Math.PI / 8, { fill: "#e76f51" }));
  focus.shapes.push(circle(500, 500, 9, { fill: "#f6f1e7" }));

  return scene;
}
