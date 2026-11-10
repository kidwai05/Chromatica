// Export helpers. Pure naming helpers plus small browser-only download code
// (nothing here touches the DOM until a function is called).
import { renderScene } from "./render-canvas.js";
import { sceneToSvg } from "./render-svg.js";

export const PNG_SIZE = 2048;

// "José Álvarez" -> "jose-alvarez"; names with no latin letters give "".
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function exportFileName(scene, ext) {
  const slug = slugify(scene.meta?.name);
  const seed = scene.meta?.seed ?? 0;
  return `chromatica-${slug ? slug + "-" : ""}${seed}.${ext}`;
}

export function exportTitle(scene) {
  const name = scene.meta?.name;
  return name ? `Chromatica: ${name}` : `Chromatica: seed ${scene.meta?.seed ?? 0}`;
}

export function renderToCanvas(scene, px = PNG_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  // The scene is square, so at a square size it fills the canvas edge to edge.
  renderScene(canvas.getContext("2d"), scene, { width: px, height: px });
  return canvas;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(scene) {
  const svg = sceneToSvg(scene, { title: exportTitle(scene) });
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), exportFileName(scene, "svg"));
}

export function exportPng(scene, px = PNG_SIZE) {
  return new Promise((resolve, reject) => {
    renderToCanvas(scene, px).toBlob((blob) => {
      if (!blob) return reject(new Error("PNG encoding failed"));
      downloadBlob(blob, exportFileName(scene, "png"));
      resolve();
    }, "image/png");
  });
}
