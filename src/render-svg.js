// SVG renderer: the same scene description the Canvas renderer reads, written
// out as a standalone, resolution-independent SVG document. Pure string
// building, so it runs in the browser and in Node (see scripts/).
//
// Fidelity notes (so Canvas and SVG match):
//  * Coordinates are rounded to 2 decimals everywhere.
//  * Canvas applies globalAlpha to fill and stroke separately, so we use
//    fill-opacity / stroke-opacity rather than a whole-element opacity.
//  * Colours are written as hex, because some SVG editors do not read hsl().
import { polygonPoints } from "./geometry.js";

const num = (n) => String(Math.round(n * 100) / 100);

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

// "hsl(210.0, 50.0%, 40.0%)" -> "#336699"; anything else passes through.
export function toHex(color) {
  const m = /^hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)$/.exec(color);
  return m ? hslToHex(Number(m[1]), Number(m[2]), Number(m[3])) : color;
}

function paint(s) {
  let a = "";
  a += s.fill ? ` fill="${toHex(s.fill)}"` + (s.opacity !== 1 ? ` fill-opacity="${num(s.opacity)}"` : "") : ` fill="none"`;
  if (s.stroke) {
    a += ` stroke="${toHex(s.stroke)}" stroke-width="${num(s.strokeWidth)}"`;
    if (s.opacity !== 1) a += ` stroke-opacity="${num(s.opacity)}"`;
  }
  return a;
}

const writers = {
  circle: (s) => `<circle cx="${num(s.x)}" cy="${num(s.y)}" r="${num(s.r)}"${paint(s)}/>`,
  rect: (s) =>
    `<rect x="${num(-s.w / 2)}" y="${num(-s.h / 2)}" width="${num(s.w)}" height="${num(s.h)}"` +
    ` transform="translate(${num(s.x)} ${num(s.y)}) rotate(${Math.round(((s.rotation * 180) / Math.PI) * 1000) / 1000})"${paint(s)}/>`,
  polygon: (s) =>
    `<polygon points="${polygonPoints(s.x, s.y, s.r, s.sides, s.rotation)
      .map((p) => `${num(p.x)},${num(p.y)}`)
      .join(" ")}"${paint(s)}/>`,
  line: (s) =>
    `<line x1="${num(s.x1)}" y1="${num(s.y1)}" x2="${num(s.x2)}" y2="${num(s.y2)}" stroke-linecap="round"${paint(s)}/>`,
};

export function sceneToSvg(scene, { title = "Chromatica artwork" } = {}) {
  const size = scene.size;
  const meta = scene.meta;
  const desc = meta
    ? `Chromatica ${meta.algorithm} | seed ${meta.seed} | recipe ${JSON.stringify(meta.recipe)}`
    : "Chromatica artwork";

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">`,
    `<title>${escapeXml(title)}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<rect width="${size}" height="${size}" fill="${toHex(scene.background)}"/>`,
  ];

  for (const layer of scene.layers) {
    out.push(`<g id="layer-${escapeXml(layer.name)}">`);
    for (const shape of layer.shapes) {
      const write = writers[shape.type];
      if (!write) throw new Error(`Unknown shape type: ${shape.type}`);
      out.push(write(shape));
    }
    out.push("</g>");
  }
  out.push("</svg>", "");
  return out.join("\n");
}
