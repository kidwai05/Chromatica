// Colour palettes built from hue relationships (HSL).
//
// The same number of random draws happens for every mode, so switching the
// palette mode keeps the base hue, saturation and lightness; only the hue
// relationships change.

export const PALETTE_MODES = ["complementary", "analogous", "triadic"];
export const PALETTE_SIZE = 5;

const HUE_OFFSETS = {
  complementary: [0, 10, 180, 190, -10],
  analogous: [-36, -18, 0, 18, 36],
  triadic: [0, 120, 240, 12, 132],
};

const wrapHue = (h) => ((h % 360) + 360) % 360;
const css = (h, s, l) => `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;

// requested: "auto" (the seed picks a mode) or one of PALETTE_MODES.
export function generatePalette(rng, requested = "auto") {
  const baseHue = rng.range(0, 360);
  const autoMode = rng.pick(PALETTE_MODES);
  const dark = rng.chance(0.4);
  const mode = PALETTE_MODES.includes(requested) ? requested : autoMode;

  const colors = HUE_OFFSETS[mode].map((offset) => {
    const h = wrapHue(baseHue + offset);
    const s = rng.range(55, 85);
    const l = rng.range(42, 68);
    return { h, s, l, css: css(h, s, l) };
  });

  return {
    mode,
    baseHue,
    dark,
    colors,
    background: dark ? css(baseHue, 25, 11) : css(baseHue, 30, 95),
    ink: dark ? css(baseHue, 20, 92) : css(baseHue, 35, 14),
  };
}
