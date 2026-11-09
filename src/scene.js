// Scene description: plain data, no drawing, no randomness.
//
// A scene is a fixed logical canvas (default 1000 x 1000 units) holding named
// layers, each an ordered list of shapes. Renderers (Canvas now, SVG in
// Week 3) map logical units to pixels, so a scene is resolution independent.
//
// Shape types (all positions in logical units, angles in radians):
//   circle   { type, x, y, r }
//   rect     { type, x, y, w, h, rotation }          x,y = center
//   polygon  { type, x, y, r, sides, rotation }      regular polygon, x,y = center
//   line     { type, x1, y1, x2, y2 }
//
// Every shape may also carry a style:
//   fill (css color | null), stroke (css color | null), strokeWidth, opacity

export const SCENE_VERSION = 1;
export const SHAPE_TYPES = ["circle", "rect", "polygon", "line"];

export function createScene({ size = 1000, background = "#ffffff" } = {}) {
  return { version: SCENE_VERSION, size, background, layers: [] };
}

export function addLayer(scene, name) {
  const layer = { name, shapes: [] };
  scene.layers.push(layer);
  return layer;
}

function style(s = {}) {
  return {
    fill: s.fill === undefined ? null : s.fill,
    stroke: s.stroke === undefined ? null : s.stroke,
    strokeWidth: s.strokeWidth ?? 1,
    opacity: s.opacity ?? 1,
  };
}

export const circle = (x, y, r, s) => ({ type: "circle", x, y, r, ...style(s) });

export const rect = (x, y, w, h, rotation = 0, s) => ({
  type: "rect", x, y, w, h, rotation, ...style(s),
});

export const polygon = (x, y, r, sides, rotation = 0, s) => ({
  type: "polygon", x, y, r, sides, rotation, ...style(s),
});

export const line = (x1, y1, x2, y2, s) => ({
  type: "line", x1, y1, x2, y2, ...style({ stroke: "#000", ...s }),
});

export function countShapes(scene) {
  return scene.layers.reduce((n, l) => n + l.shapes.length, 0);
}
