import test from "node:test";
import assert from "node:assert/strict";
import { treeSegments, segmentCount } from "../src/fractals.js";
import { parseSeed, seedFromName, MAX_SEED } from "../src/seed.js";
import {
  generateScene, generateFromRecipe, recipeFromName, recipeFromSeed, isValidRecipe, CURRENT_ALGORITHM,
} from "../src/generator.js";
import { sceneToSvg, hslToHex, toHex, escapeXml } from "../src/render-svg.js";
import { slugify, exportFileName, exportTitle } from "../src/export.js";
import { createFavoritesStore, favoriteId, FAVORITES_KEY, MAX_FAVORITES } from "../src/storage.js";
import {
  stateFromQuery, stateToQuery, createState, recipeFromState, favoriteLabel, stateFromFavorite, DEFAULT_NAME,
} from "../src/state.js";

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// In-memory stand-in for localStorage.
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

// ---------- M3.1 fractal ----------

test("tree: segment count is arms * (2^(depth+1) - 1)", () => {
  for (const [arms, depth] of [[1, 0], [4, 4], [8, 6]]) {
    const segs = treeSegments({ arms, depth, reach: 300 });
    assert.equal(segs.length, segmentCount(arms, depth));
  }
});

test("tree: straight path to the tips has length exactly `reach` and stays inside it", () => {
  const cx = 500, cy = 500, reach = 290, innerR = 60;
  const segs = treeSegments({ cx, cy, arms: 5, depth: 5, reach, innerR, ratio: 0.7, spread: 0.5, twist: 0 });
  const tips = segs.filter((s) => s.depth === 5);
  assert.equal(tips.length, 5 * 2 ** 5);
  for (const s of segs) {
    for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      const d = Math.hypot(x - cx, y - cy);
      assert.ok(d >= innerR - 1e-6 && d <= reach + 1e-6, `distance ${d}`);
    }
  }
  // A twist-free, spread-free tree is a straight line: tips sit exactly at `reach`.
  const straight = treeSegments({ cx, cy, arms: 3, depth: 4, reach, innerR, ratio: 0.7, spread: 0 });
  for (const s of straight.filter((q) => q.depth === 4)) close(Math.hypot(s.x2 - cx, s.y2 - cy), reach);
});

test("tree: children start where their parent ends, and lengths shrink by ratio", () => {
  const segs = treeSegments({ arms: 1, depth: 2, reach: 100, ratio: 0.5, spread: 0.4 });
  assert.equal(segs.length, 7);
  const len = (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  close(len(segs[1]) / len(segs[0]), 0.5);
  close(len(segs[2]) / len(segs[1]), 0.5);
  assert.deepEqual([segs[1].x1, segs[1].y1], [segs[0].x2, segs[0].y2]);
});

test("fractal layer: seed drives arms and depth within range; toggle removes the layer", () => {
  const seen = new Set();
  for (const n of ["a", "b", "c", "d", "e", "f", "g", "h", "Ada Lovelace", "Grace Hopper"]) {
    const f = generateScene(n).meta.fractal;
    assert.ok(f.depth >= 4 && f.depth <= 6 && f.arms >= 4 && f.arms <= 8);
    seen.add(f.depth);
  }
  assert.ok(seen.size > 1, "depth should vary between names");

  const on = generateScene("Ada Lovelace", { fractal: true });
  const off = generateScene("Ada Lovelace", { fractal: false });
  assert.ok(on.layers.some((l) => l.name === "fractal"));
  assert.ok(!off.layers.some((l) => l.name === "fractal"));
  assert.equal(off.meta.fractal, undefined);
});

test("turning the fractal off leaves every other layer byte-identical", () => {
  const on = generateScene("Ada Lovelace", { fractal: true });
  const off = generateScene("Ada Lovelace", { fractal: false });
  const rest = (s) => s.layers.filter((l) => l.name !== "fractal");
  assert.deepEqual(rest(on), rest(off));
});

// ---------- M3.3 numeric seed ----------

test("parseSeed accepts only whole numbers 0..2^32-1", () => {
  assert.equal(parseSeed("3254028926"), 3254028926);
  assert.equal(parseSeed("  42 "), 42);
  assert.equal(parseSeed("0"), 0);
  assert.equal(parseSeed(String(MAX_SEED)), MAX_SEED);
  assert.equal(parseSeed(7), 7);
  for (const bad of ["", " ", "abc", "12abc", "-5", "1.5", "1e9", "4294967296", "99999999999", "0x10", null, undefined, -1, 1.5, NaN]) {
    assert.equal(parseSeed(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("entering a name's numeric seed reproduces the same artwork (all layers except the letter ring)", () => {
  const byName = generateScene("Ada Lovelace");
  const bySeed = generateFromRecipe(recipeFromSeed(seedFromName("Ada Lovelace")));
  assert.equal(bySeed.meta.seed, byName.meta.seed);
  const body = (s) => s.layers.filter((l) => l.name !== "signature");
  assert.deepEqual(body(bySeed), body(byName));
  assert.equal(bySeed.background, byName.background);
  // The ring differs on purpose: a hash cannot be reversed into letters.
  assert.notDeepEqual(bySeed.layers.find((l) => l.name === "signature"), byName.layers.find((l) => l.name === "signature"));
});

test("a seed recipe is itself fully deterministic", () => {
  const a = generateFromRecipe(recipeFromSeed(12345));
  const b = generateFromRecipe(recipeFromSeed(12345));
  assert.deepEqual(a, b);
  assert.throws(() => recipeFromSeed(-1), RangeError);
  assert.throws(() => recipeFromSeed(MAX_SEED + 1), RangeError);
});

// ---------- M3.4 versioning ----------

test("every scene records its algorithm version and a replayable recipe", () => {
  const scene = generateScene("Ada Lovelace", { shape: "circle", density: 0.8 });
  assert.equal(scene.meta.algorithm, CURRENT_ALGORITHM);
  assert.equal(scene.meta.recipe.algorithm, "v1");
  assert.deepEqual(generateFromRecipe(scene.meta.recipe), scene);
  // Survives a JSON round trip (this is what localStorage does).
  assert.deepEqual(generateFromRecipe(JSON.parse(JSON.stringify(scene.meta.recipe))), scene);
});

test("very long names still make valid recipes; the seed uses the whole name", () => {
  const a = "x".repeat(500);
  const b = "x".repeat(499) + "y";
  const ra = recipeFromName(a);
  assert.ok(isValidRecipe(ra));
  assert.equal(Array.from(ra.text).length, 200);
  assert.notEqual(ra.seed, recipeFromName(b).seed);
  assert.deepEqual(generateFromRecipe(ra), generateScene(a));
  const emoji = recipeFromName("🎨".repeat(300));
  assert.ok(isValidRecipe(emoji) && !/\ud83c(?![\udf00-\udfff])$/.test(emoji.text));
});

test("unknown algorithm versions fail loudly instead of drawing something else", () => {
  assert.throws(() => generateFromRecipe({ ...recipeFromName("Ada"), algorithm: "v99" }), /Unknown algorithm/);
  assert.throws(() => generateFromRecipe({ nope: true }), /Invalid recipe/);
  assert.equal(isValidRecipe(recipeFromName("Ada")), true);
  assert.equal(isValidRecipe({ ...recipeFromName("Ada"), seed: -1 }), false);
  assert.equal(isValidRecipe({ ...recipeFromName("Ada"), source: "dream" }), false);
});

test("v1 is frozen: pinned output of the whole pipeline", () => {
  const scene = generateScene("Ada Lovelace");
  assert.equal(scene.meta.seed, 3254028926);
  assert.deepEqual(scene.layers.map((l) => `${l.name}:${l.shapes.length}`),
    ["texture:81", "scatter:88", "fractal:248", "web:54", "rings:80", "signature:12", "focus:3"]);
  assert.equal(scene.meta.palette.mode, "analogous");
  assert.deepEqual(
    { arms: scene.meta.fractal.arms, depth: scene.meta.fractal.depth },
    { arms: 8, depth: 4 },
  );
});

// ---------- M3.2 SVG ----------

test("hslToHex matches known colours", () => {
  assert.equal(hslToHex(0, 100, 50), "#ff0000");
  assert.equal(hslToHex(120, 100, 50), "#00ff00");
  assert.equal(hslToHex(240, 100, 50), "#0000ff");
  assert.equal(hslToHex(0, 0, 100), "#ffffff");
  assert.equal(hslToHex(0, 0, 0), "#000000");
  assert.equal(toHex("hsl(210.0, 50.0%, 40.0%)"), "#336699");
  assert.equal(toHex("#123456"), "#123456");
});

test("escapeXml handles markup characters", () => {
  assert.equal(escapeXml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("SVG: one element per shape, one group per layer, no hsl() left, no NaN", () => {
  const scene = generateScene("Ada Lovelace");
  const svg = sceneToSvg(scene);
  const shapes = scene.layers.reduce((n, l) => n + l.shapes.length, 0);
  const elements = (svg.match(/<(circle|rect|polygon|line) /g) ?? []).length - 1; // minus the background rect
  assert.equal(elements, shapes);
  assert.equal((svg.match(/<g id="layer-/g) ?? []).length, scene.layers.length);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"'));
  assert.ok(!svg.includes("hsl("));
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
});

test("SVG: deterministic, embeds the recipe, escapes the title", () => {
  const scene = generateScene("Ada Lovelace");
  assert.equal(sceneToSvg(scene), sceneToSvg(generateScene("  ADA lovelace ")));
  const svg = sceneToSvg(scene, { title: `A <&> "B"` });
  assert.ok(svg.includes("<title>A &lt;&amp;&gt; &quot;B&quot;</title>"));
  assert.ok(svg.includes("seed 3254028926"));
  assert.ok(!svg.includes("<&>"));
});

test("SVG: opacity uses fill-opacity / stroke-opacity, unfilled shapes get fill=none", () => {
  const svg = sceneToSvg(generateScene("Ada Lovelace"));
  assert.match(svg, /<line [^>]*stroke-opacity="0\.\d+"/);
  assert.match(svg, /<circle [^>]*fill="none"/); // the guide ring
  assert.match(svg, /<circle [^>]*fill="#[0-9a-f]{6}" fill-opacity="0\.\d+"/);
  assert.ok(!/ opacity="/.test(svg));
});

// ---------- M3.2 export names ----------

test("slugify and file names", () => {
  assert.equal(slugify("José Álvarez-Smith"), "jose-alvarez-smith");
  assert.equal(slugify("  Ada   Lovelace!! "), "ada-lovelace");
  assert.equal(slugify("李小龍"), "");
  assert.equal(slugify("🎨"), "");
  assert.ok(slugify("x".repeat(200)).length <= 40);
  assert.equal(exportFileName(generateScene("Ada Lovelace"), "svg"), "chromatica-ada-lovelace-3254028926.svg");
  assert.equal(exportFileName(generateFromRecipe(recipeFromSeed(77)), "png"), "chromatica-77.png");
  assert.equal(exportFileName(generateScene("李小龍"), "png"), `chromatica-${seedFromName("李小龍")}.png`);
  assert.equal(exportTitle(generateScene("Ada Lovelace")), "Chromatica: ada lovelace");
  assert.equal(exportTitle(generateFromRecipe(recipeFromSeed(77))), "Chromatica: seed 77");
  assert.ok(!/[\\/:*?"<>|\s]/.test(exportFileName(generateScene('a/b\\c:d*e?"f<g>h|i j'), "svg")));
});

// ---------- M3.3 favourites ----------

test("favorites: save, list newest first, dedupe, remove, clear", () => {
  let t = 1000;
  const store = createFavoritesStore(memoryStorage(), () => t++);
  const ada = recipeFromName("Ada Lovelace");
  const grace = recipeFromName("Grace Hopper");

  store.add(ada, "Ada Lovelace");
  store.add(grace, "Grace Hopper");
  assert.deepEqual(store.list().map((f) => f.label), ["Grace Hopper", "Ada Lovelace"]);

  const again = store.add(ada, "Ada Lovelace"); // same recipe: moves to the top, no duplicate
  assert.equal(again.list.length, 2);
  assert.equal(store.list()[0].label, "Ada Lovelace");

  const id = favoriteId(grace);
  assert.equal(store.remove(id).list.length, 1);
  assert.equal(store.clear().list.length, 0);
});

test("favorites: id depends on the full recipe", () => {
  const base = favoriteId(recipeFromName("Ada Lovelace"));
  assert.equal(base, favoriteId(recipeFromName("  ADA lovelace ")));
  assert.notEqual(base, favoriteId(recipeFromName("Ada Lovelace", { shape: "circle" })));
  assert.notEqual(base, favoriteId(recipeFromName("Ada Lovelace", { fractal: false })));
  assert.notEqual(base, favoriteId(recipeFromName("Grace Hopper")));
  assert.notEqual(base, favoriteId(recipeFromSeed(seedFromName("Ada Lovelace"))));
});

test("favorites: a saved favourite reopens as the identical artwork", () => {
  const storage = memoryStorage();
  const recipe = recipeFromName("Grace Hopper", { shape: "polygon", density: 0.9, paletteMode: "triadic", sizeMax: 90 });
  createFavoritesStore(storage).add(recipe, "Grace Hopper");

  // New store instance, as after a page reload.
  const [fav] = createFavoritesStore(storage).list();
  assert.deepEqual(generateFromRecipe(fav.recipe), generateFromRecipe(recipe));
  assert.equal(fav.recipe.algorithm, "v1");
});

test("favorites: survives missing, throwing, full and corrupt storage", () => {
  assert.deepEqual(createFavoritesStore(null).list(), []);
  assert.equal(createFavoritesStore(null).add(recipeFromName("a"), "a").ok, false);
  assert.equal(createFavoritesStore(null).available, false);

  const throwing = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  const s = createFavoritesStore(throwing);
  assert.deepEqual(s.list(), []);
  assert.equal(s.add(recipeFromName("a"), "a").ok, false);

  for (const junk of ["{not json", "42", '"str"', "null", '{"a":1}']) {
    assert.deepEqual(createFavoritesStore(memoryStorage({ [FAVORITES_KEY]: junk })).list(), []);
  }
  // Valid and invalid records mixed: bad ones are dropped, good ones kept.
  const good = { id: "x", label: "ok", savedAt: 1, recipe: recipeFromName("Ada") };
  const mixed = JSON.stringify([good, { id: 5 }, { ...good, recipe: { algorithm: "v1" } }, null]);
  assert.deepEqual(createFavoritesStore(memoryStorage({ [FAVORITES_KEY]: mixed })).list().map((f) => f.id), ["x"]);
});

test("favorites: capped, and long labels truncated", () => {
  const store = createFavoritesStore(memoryStorage());
  for (let i = 0; i < MAX_FAVORITES + 10; i++) store.add(recipeFromSeed(i), `s${i}`);
  assert.equal(store.list().length, MAX_FAVORITES);
  assert.equal(store.list()[0].label, `s${MAX_FAVORITES + 9}`);
  assert.equal(store.add(recipeFromName("long"), "x".repeat(500)).record.label.length, 80);
});

// ---------- state / URL ----------

test("state: URL round trip for names and for seeds", () => {
  const s = createState();
  s.name = "Grace Hopper";
  s.params = { shape: "circle", sizeMin: 20, sizeMax: 80, density: 0.7, paletteMode: "triadic", fractal: false };
  const q = stateToQuery(s);
  const back = stateFromQuery(`?${q}`);
  assert.deepEqual(back, { mode: "name", name: "Grace Hopper", seed: null, params: s.params });

  const seeded = { mode: "seed", name: "", seed: 3254028926, params: createState().params };
  assert.equal(stateToQuery(seeded), "seed=3254028926");
  assert.deepEqual(stateFromQuery("?seed=3254028926"), seeded);
});

test("state: defaults give an empty query; hostile query strings are repaired", () => {
  assert.equal(stateToQuery(createState()), "");
  assert.equal(stateFromQuery("").name, DEFAULT_NAME);
  const hostile = stateFromQuery("?seed=banana&shape=star&min=-9&max=zzz&density=7&palette=neon&fractal=0&name=" + "x".repeat(500));
  assert.equal(hostile.name.length, 80);
  assert.equal(hostile.mode, "name");
  assert.equal(hostile.params.shape, "mixed");
  assert.equal(hostile.params.density, 1);
  assert.equal(hostile.params.paletteMode, "auto");
  assert.equal(hostile.params.fractal, false);
  assert.ok(hostile.params.sizeMin <= hostile.params.sizeMax);
  assert.equal(stateFromQuery("?seed=nonsense").mode, "name"); // bad seed falls back to the default name
  assert.equal(stateFromQuery("?name=Ada&seed=5").mode, "name"); // name wins over seed
});

test("state: recipes, labels and favourites connect up", () => {
  const nameState = stateFromQuery("?name=Alan%20Turing");
  assert.equal(recipeFromState(nameState).seed, seedFromName("Alan Turing"));
  assert.equal(favoriteLabel(nameState), "Alan Turing");
  assert.equal(favoriteLabel({ ...nameState, name: "   " }), "(empty name)");

  const seedState = stateFromQuery("?seed=77");
  assert.equal(recipeFromState(seedState).source, "seed");
  assert.equal(favoriteLabel(seedState), "Seed 77");

  for (const st of [nameState, seedState]) {
    const fav = { label: favoriteLabel(st), recipe: recipeFromState(st) };
    assert.deepEqual(stateFromFavorite(fav), { ...st, params: st.params });
    assert.deepEqual(generateFromRecipe(recipeFromState(stateFromFavorite(fav))), generateFromRecipe(fav.recipe));
  }
});
