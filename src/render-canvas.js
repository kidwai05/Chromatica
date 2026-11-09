// Canvas renderer: scene description in, pixels out. It knows nothing about
// how a scene was generated. The Week 3 SVG exporter will walk the same data.
import { polygonPoints } from "./geometry.js";

// Fit the square logical scene inside the viewport, centered ("contain").
export function fitScene(scene, width, height) {
  const scale = Math.min(width, height) / scene.size;
  return {
    scale,
    offsetX: (width - scene.size * scale) / 2,
    offsetY: (height - scene.size * scale) / 2,
  };
}

function applyStyle(ctx, shape) {
  ctx.globalAlpha = shape.opacity;
  ctx.lineWidth = shape.strokeWidth;
  if (shape.fill) { ctx.fillStyle = shape.fill; ctx.fill(); }
  if (shape.stroke) { ctx.strokeStyle = shape.stroke; ctx.stroke(); }
}

const drawers = {
  circle(ctx, s) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    applyStyle(ctx, s);
  },
  rect(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);
    ctx.beginPath();
    ctx.rect(-s.w / 2, -s.h / 2, s.w, s.h);
    applyStyle(ctx, s);
    ctx.restore();
  },
  polygon(ctx, s) {
    const pts = polygonPoints(s.x, s.y, s.r, s.sides, s.rotation);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    applyStyle(ctx, s);
  },
  line(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.lineCap = "round";
    applyStyle(ctx, s);
  },
};

// viewport: { width, height } in CSS pixels (ctx is already dpr-scaled).
export function renderScene(ctx, scene, viewport) {
  const { width, height } = viewport;
  const { scale, offsetX, offsetY } = fitScene(scene, width, height);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Letterbox area, then the scene's own background square.
  ctx.fillStyle = "#0f1115";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.size, scene.size);
  ctx.beginPath();
  ctx.rect(0, 0, scene.size, scene.size);
  ctx.clip();

  for (const layer of scene.layers) {
    for (const shape of layer.shapes) {
      const draw = drawers[shape.type];
      if (!draw) throw new Error(`Unknown shape type: ${shape.type}`);
      ctx.save();
      draw(ctx, shape);
      ctx.restore();
    }
  }
  ctx.restore();
}
