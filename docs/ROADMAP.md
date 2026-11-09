# Roadmap

## Layers

| # | Layer | Responsibility |
|---|-------|----------------|
| 1 | Seed | Normalize the name (trim, lowercase, NFC, collapse spaces) and hash to a 32-bit integer |
| 2 | PRNG | Deterministic `next()`, `range()`, `pick()` (mulberry32 / sfc32) |
| 3 | Streams | Independent RNG streams per concern (`palette`, `layout`, `pattern`) |
| 4 | Name signature | Letters map to angles, hue offsets and shape counts |
| 5 | Colour | Complementary, analogous and triadic palettes (HSL) |
| 6 | Geometry | Shapes, sizes, grids, rotation, density |
| 7 | Pattern | Fractal-inspired structures (recursive trees, spirals) |
| 8 | Render | One scene description, Canvas and SVG renderers |
| 9 | UI | Name input, seed display, controls |
| 10 | Persistence / export | Favourites, PNG and SVG export |

## Week 1: Rendering and geometry (done)

- [x] M1.1 Scaffold with a responsive, HiDPI canvas
- [x] M1.2 Circles, polygons, lines and rectangles from a hardcoded scene object
- [x] M1.3 Grid, radial and scatter layouts
- [x] M1.4 Scene-graph structure with the renderer separated from the generator

## Week 2: Seed, colour and customization

- [ ] M2.1 Name -> normalize -> hash -> PRNG, with a test that the same name gives the same first 100 numbers
- [ ] M2.2 Stream forking
- [ ] M2.3 Palette generators (complementary, analogous, triadic)
- [ ] M2.4 Name-signature layer
- [ ] M2.5 Controls for shape type, size range, density, palette mode

## Week 3: Fractals, export and polish

- [ ] M3.1 One fractal pattern with a seed-driven depth
- [ ] M3.2 SVG exporter from the scene graph, plus PNG export
- [ ] M3.3 Save and load favourites, numeric-seed input
- [ ] M3.4 Algorithm version tag (`v1`) stored with every save
- [ ] M3.5 UI polish, README GIFs, GitHub Pages demo

## Determinism pitfalls

- RNG call order matters; fork a stream per concern.
- Iterate in a fixed order; never depend on object key order or async timing.
- Version the algorithm so old favourites still render with `v1`.
- Round coordinates consistently so Canvas and SVG match.
- Test empty input, emoji, accents and very long names.
