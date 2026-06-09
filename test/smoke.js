#!/usr/bin/env node
// Smoke test for swatchkit's config loading and CSS layout.
// Runs swatchkit in fresh ESM and CJS project setups to confirm:
//   - src/css/ contains the scaffolded CSS
//   - dist/swatchkit/css/main.css exists (was missing before the .default unwrap fix)
//   - No stray root css/ directory gets created
//   - All four config file formats (.js ESM, .js CJS, .cjs, .mjs) load correctly
//
// Run: npm test
// Exits non-zero on any failure.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const SWATCHKIT = path.join(__dirname, "..", "build.js");
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "swatchkit-smoke-"));

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`    ${detail}`);
  failed++;
}

function runSwatchkit(label, dir, args) {
  try {
    execSync(`node "${SWATCHKIT}" ${args.map((a) => `"${a}"`).join(" ")}`, {
      cwd: dir,
      stdio: "pipe",
    });
    ok(label);
  } catch (e) {
    fail(label, (e.stderr || e.stdout || e.message).toString().split("\n")[0]);
  }
}

function exists(p) {
  return fs.existsSync(p);
}

const ESM_PKG = JSON.stringify(
  { name: "smoke-esm", version: "1.0.0", type: "module" },
  null,
  2,
);
const CJS_PKG = JSON.stringify(
  { name: "smoke-cjs", version: "1.0.0" },
  null,
  2,
);

function freshDir(name) {
  const dir = path.join(TMP_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

// 1. ESM project, swatchkit init + build
{
  console.log("\n[1] ESM project, swatchkit init (--cssDir ./src/css)");
  const dir = freshDir("1-esm-init");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "src/css/main.css")) ? ok("src/css/main.css exists") : fail("src/css/main.css exists");
  exists(path.join(dir, "src/css/global/tokens.css")) ? ok("global/tokens.css (user-owned) exists") : fail("global/tokens.css exists");
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir", "found css/ at project root") : ok("no stray root css/ dir");
  // No JSON tokens dir anymore
  exists(path.join(dir, "tokens")) ? fail("no JSON tokens/ dir created") : ok("no JSON tokens/ dir created");
  // utilities.css generated from token blocks
  read(path.join(dir, "src/css/utilities/utilities.css")).includes(".color\\:color-primary")
    ? ok("utilities.css generated with color utility")
    : fail("utilities.css generated with color utility");
}

// 2. CJS project, swatchkit init + build
{
  console.log("\n[2] CJS project, swatchkit init (--cssDir ./src/css)");
  const dir = freshDir("2-cjs-init");
  fs.writeFileSync(path.join(dir, "package.json"), CJS_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "src/css/main.css")) ? ok("src/css/main.css exists") : fail("src/css/main.css exists");
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir") : ok("no stray root css/ dir");
}

// 3. ESM project, hand-written export default config
//    (regression guard: Node 22+ returns a Module namespace from require()
//    of an ESM file; without the .default unwrap, cssDir silently falls back.)
{
  console.log("\n[3] ESM project, hand-written export default config (the regression case)");
  const dir = freshDir("3-esm-export");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    'export default { cssDir: "./src/css", cssCopy: true };\n',
  );
  runSwatchkit("init", dir, ["init"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists (regression: must NOT be missing)") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir") : ok("no stray root css/ dir");
  exists(path.join(dir, "src/css/global/tokens.css")) ? ok("tokens.css written to src/css/global/") : fail("tokens.css written to src/css/global/");
}

// 4. CJS project, hand-written module.exports config
{
  console.log("\n[4] CJS project, hand-written module.exports config");
  const dir = freshDir("4-cjs-export");
  fs.writeFileSync(path.join(dir, "package.json"), CJS_PKG);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    'module.exports = { cssDir: "./src/css", cssCopy: true };\n',
  );
  runSwatchkit("init", dir, ["init"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
}

// 5. ESM project, swatchkit.config.cjs
{
  console.log("\n[5] ESM project, swatchkit.config.cjs");
  const dir = freshDir("5-cjs-config");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.cjs"),
    'module.exports = { cssDir: "./src/css", cssCopy: true };\n',
  );
  runSwatchkit("init", dir, ["init"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
}

// 6. ESM project, swatchkit.config.mjs
{
  console.log("\n[6] ESM project, swatchkit.config.mjs");
  const dir = freshDir("6-mjs-config");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.mjs"),
    'export default { cssDir: "./src/css", cssCopy: true };\n',
  );
  runSwatchkit("init", dir, ["init"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
}

// 7. Token docs are generated for every token type
{
  console.log("\n[7] Token documentation pages generated from CSS blocks");
  const dir = freshDir("7-token-docs");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  runSwatchkit("build", dir, []);
  const tokenTypes = ["colors", "fonts", "spacing", "text-sizes", "text-weights", "text-leading", "viewports"];
  for (const t of tokenTypes) {
    exists(path.join(dir, `dist/swatchkit/preview/tokens/${t}/index.html`))
      ? ok(`token doc page: ${t}`)
      : fail(`token doc page: ${t}`);
  }
  // viewports must NOT produce utilities; colors must.
  const util = read(path.join(dir, "src/css/utilities/utilities.css"));
  util.includes(".font-size\\:step-0") ? ok("font-size utility generated") : fail("font-size utility generated");
  !util.includes("viewport-min") ? ok("viewports produce no utilities") : fail("viewports produce no utilities");
}

// 8. Theme variants + dedup + verbatim relational values
{
  console.log("\n[8] Theme-variant blocks: dedup utilities, verbatim relational values");
  const dir = freshDir("8-theme-variants");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  // Add a theme file with light/dark variant blocks of the same token.
  const themeCss = `:root {
  /* @swatchkit colors "Light Palette" */
  --brand: oklch(0.6 0.15 250);
  --brand-hover: oklch(from var(--brand) calc(l + 0.06) c h);
  /* @swatchkit end */
}
[data-theme="dark"] {
  /* @swatchkit colors "Dark Palette" */
  --brand: oklch(0.7 0.15 250);
  --brand-hover: oklch(from var(--brand) calc(l - 0.06) c h);
  /* @swatchkit end */
}
`;
  fs.writeFileSync(path.join(dir, "src/css/theme.css"), themeCss);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    'export default { cssDir: "./src/css", cssCopy: true, tokenSources: ["./src/css/global/tokens.css", "./src/css/theme.css"] };\n',
  );
  runSwatchkit("build", dir, []);
  const util = read(path.join(dir, "src/css/utilities/utilities.css"));
  // --brand appears in both Light and Dark blocks → utility emitted exactly once
  const count = (util.match(/\.color\\:brand \{/g) || []).length;
  count === 1 ? ok("duplicate token utility deduped to 1") : fail("duplicate token utility deduped to 1", `got ${count}`);
  // both variant doc pages exist
  exists(path.join(dir, "dist/swatchkit/preview/tokens/light-palette/index.html")) ? ok("Light Palette doc page") : fail("Light Palette doc page");
  exists(path.join(dir, "dist/swatchkit/preview/tokens/dark-palette/index.html")) ? ok("Dark Palette doc page") : fail("Dark Palette doc page");
  // verbatim relational value preserved in docs
  read(path.join(dir, "dist/swatchkit/preview/tokens/light-palette/index.html"))
    .includes("oklch(from var(--brand) calc(l + 0.06) c h)")
    ? ok("relational oklch value preserved verbatim")
    : fail("relational oklch value preserved verbatim");
}

// 9. Build fails clearly on malformed token markers
{
  console.log("\n[9] Malformed @swatchkit markers fail the build");
  const dir = freshDir("9-bad-markers");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  // Missing @swatchkit end
  fs.writeFileSync(
    path.join(dir, "src/css/global/tokens.css"),
    ':root {\n  /* @swatchkit colors "Broken" */\n  --x: #fff;\n}\n',
  );
  let failed7 = false;
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
  } catch (e) {
    failed7 = true;
  }
  failed7 ? ok("build errors on unclosed @swatchkit block") : fail("build errors on unclosed @swatchkit block");
}

// 10. swatchkit no longer recognizes `new` / `scaffold`
{
  console.log("\n[10] Removed commands: new/scaffold are not special-cased");
  const dir = freshDir("10-removed-cmds");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  // `new`/`scaffold` should be treated as the default (build) command, which
  // errors because the project isn't initialized — i.e. they are NOT the old
  // commands. We assert the build-style error path runs (non-zero exit).
  let scaffoldFailed = false;
  try {
    execSync(`node "${SWATCHKIT}" scaffold`, { cwd: dir, stdio: "pipe" });
  } catch (e) {
    scaffoldFailed = true;
  }
  scaffoldFailed ? ok("`scaffold` is no longer a command (falls through to build, errors uninitialized)") : fail("`scaffold` removed");
}

// 11. `init --app` scaffolds the integrated app starter
{
  console.log("\n[11] init --app scaffolds the integrated app starter");
  const dir = freshDir("11-init-app");
  // Truly empty dir (no package.json) — --app should create one.
  runSwatchkit("init --app", dir, ["init", "--app", "--cssDir", "./src/css"]);

  // App files scaffolded
  const appFiles = [
    "scripts/clean.js",
    "scripts/build-site.js",
    "scripts/build-assets.js",
    "src/components/button.js",
    "src/components/card.js",
    "src/pages/home.js",
    "src/js/main.js",
    "src/css/swatches/button.css",
    "src/css/swatches/card.css",
    "swatchkit/swatches/button/index.js",
    "swatchkit/swatches/card/index.js",
  ];
  let allFiles = true;
  for (const f of appFiles) {
    if (!exists(path.join(dir, f))) {
      allFiles = false;
      fail(`app file: ${f}`);
    }
  }
  if (allFiles) ok("all app starter files scaffolded");

  // Integrated config is ESM + cssCopy:false
  const cfg = read(path.join(dir, "swatchkit.config.js"));
  cfg.includes("export default") && cfg.includes("cssCopy: false")
    ? ok("integrated ESM config (cssCopy:false)")
    : fail("integrated ESM config (cssCopy:false)");

  // package.json created with dev/watch scripts + type module
  const pkg = JSON.parse(read(path.join(dir, "package.json")) || "{}");
  pkg.type === "module" ? ok("package.json type:module") : fail("package.json type:module");
  pkg.scripts && pkg.scripts.dev && pkg.scripts["watch:assets"]
    ? ok("package.json has dev + watch scripts")
    : fail("package.json has dev + watch scripts");
  pkg.devDependencies && pkg.devDependencies.esbuild && pkg.devDependencies.onchange
    ? ok("package.json has esbuild + onchange devDeps")
    : fail("package.json has esbuild + onchange devDeps");

  // Component CSS registered in swatches/index.css
  const swatchIdx = read(path.join(dir, "src/css/swatches/index.css"));
  swatchIdx.includes('@import "button.css";') && swatchIdx.includes('@import "card.css";')
    ? ok("component CSS registered in swatches/index.css")
    : fail("component CSS registered in swatches/index.css");

  // Build works (uses local swatchkit; esbuild not needed for the swatchkit step,
  // and build:assets is a separate npm script, so just run the swatchkit build).
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/preview/swatches/button/index.html"))
    ? ok("button swatch builds")
    : fail("button swatch builds");
  exists(path.join(dir, "dist/swatchkit/preview/swatches/card/index.html"))
    ? ok("card swatch builds")
    : fail("card swatch builds");
}

// 12. Cascade layers: main.css declares layer order; utilities have no !important
{
  console.log("\n[12] Cascade layers + no !important in utilities");
  const dir = freshDir("12-cascade-layers");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);
  runSwatchkit("build", dir, []);

  const mainCss = read(path.join(dir, "src/css/main.css"));
  // Layer order declaration, utilities last
  /@layer\s+reset,\s*tokens,\s*elements,\s*compositions,\s*swatches,\s*app,\s*utilities\s*;/.test(mainCss)
    ? ok("main.css declares layer order (utilities last)")
    : fail("main.css declares layer order (utilities last)");
  // Imports assign layers
  mainCss.includes('@import "global/reset.css" layer(reset);')
    ? ok("reset imported into layer(reset)")
    : fail("reset imported into layer(reset)");
  mainCss.includes('@import "utilities/index.css" layer(utilities);')
    ? ok("utilities imported into layer(utilities)")
    : fail("utilities imported into layer(utilities)");
  mainCss.includes("@layer app {")
    ? ok("main.css has @layer app block")
    : fail("main.css has @layer app block")

  // Generated utilities contain real rules but NO !important declarations
  const util = read(path.join(dir, "src/css/utilities/utilities.css"));
  util.includes(".color\\:color-primary { color: var(--color-primary); }")
    ? ok("color utility generated without !important")
    : fail("color utility generated without !important");
  // No "!important" outside comments: strip /* ... */ then check
  const utilNoComments = util.replace(/\/\*[\s\S]*?\*\//g, "");
  !utilNoComments.includes("!important")
    ? ok("no !important in generated utility rules")
    : fail("no !important in generated utility rules");

  // No stray global/index.css blueprint anymore
  exists(path.join(dir, "src/css/global/index.css"))
    ? fail("global/index.css should no longer be scaffolded")
    : ok("global/index.css not scaffolded (flattened into main.css)");
}

// Cleanup
fs.rmSync(TMP_ROOT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
