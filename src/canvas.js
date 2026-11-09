// Responsive, HiDPI-aware canvas setup.
//
// The canvas CSS size is controlled by the layout (style.css).
// Here we match the internal pixel buffer to it, scaled by devicePixelRatio,
// so drawing stays sharp. All drawing code then works in CSS pixels.

export function createCanvasController(canvas, onResize) {
  const ctx = canvas.getContext("2d");
  const state = { width: 0, height: 0, dpr: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Reset transform, then scale so 1 unit = 1 CSS pixel.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.width = width;
    state.height = height;
    state.dpr = dpr;

    onResize(ctx, state);
  }

  // Redraw whenever the canvas element changes size (window resize,
  // layout change, mobile rotation).
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  resize();

  return { ctx, state, resize, destroy: () => observer.disconnect() };
}
