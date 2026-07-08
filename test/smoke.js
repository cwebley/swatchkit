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

// 13. init --app upgrades a non-ESM package.json to "type": "module" BEFORE
//     writing/loading the ESM config (regression: previously failed with
//     "Unexpected token 'export'" on the build).
{
  console.log("\n[13] init --app makes a CJS project ESM, then builds");
  const dir = freshDir("13-app-cjs-to-esm");
  // Start with a CommonJS package.json (no "type": "module") — the failing case.
  fs.writeFileSync(path.join(dir, "package.json"), CJS_PKG);
  runSwatchkit("init --app", dir, ["init", "--app", "--cssDir", "./src/css"]);

  const pkg = JSON.parse(read(path.join(dir, "package.json")) || "{}");
  pkg.type === "module"
    ? ok("CJS package.json upgraded to type:module")
    : fail("CJS package.json upgraded to type:module");

  const cfg = read(path.join(dir, "swatchkit.config.js"));
  cfg.includes("export default")
    ? ok("ESM config written")
    : fail("ESM config written");

  // The build must now succeed (this is what used to throw).
  let buildFailed = false;
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
  } catch (e) {
    buildFailed = true;
  }
  buildFailed
    ? fail("build succeeds after init --app on a CJS project")
    : ok("build succeeds after init --app on a CJS project");
}

// 14. Stale generated token docs are cleaned when a block is removed/renamed,
//     hand-authored token pages are preserved, and unchanged docs aren't churned.
{
  console.log("\n[14] Stale generated token docs cleanup (marker-based)");
  const dir = freshDir("14-stale-token-docs");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  const tokensCss = path.join(dir, "src/css/global/tokens.css");
  const tokenDocsDir = path.join(dir, "swatchkit/tokens");

  // Add a temporary token block.
  fs.appendFileSync(
    tokensCss,
    '\n:root {\n  /* @swatchkit colors "Temporary Colors" */\n  --temp-one: #abcabc;\n  /* @swatchkit end */\n}\n',
  );
  // Add a hand-authored token page (no generated marker) — must survive.
  fs.mkdirSync(tokenDocsDir, { recursive: true });
  fs.writeFileSync(path.join(tokenDocsDir, "manual.html"), "<p>hand authored</p>");

  runSwatchkit("build (with temp block)", dir, []);
  const tempDoc = path.join(tokenDocsDir, "temporary-colors.html");
  exists(tempDoc) ? ok("temporary token doc generated") : fail("temporary token doc generated");
  read(tempDoc).includes("@swatchkit generated-token-doc")
    ? ok("generated doc carries the marker")
    : fail("generated doc carries the marker");

  // Rename the block, rebuild.
  fs.writeFileSync(
    tokensCss,
    read(tokensCss).replace(
      '@swatchkit colors "Temporary Colors"',
      '@swatchkit colors "Renamed Colors"',
    ),
  );
  runSwatchkit("build (renamed block)", dir, []);

  !exists(tempDoc)
    ? ok("stale temporary-colors.html removed after rename")
    : fail("stale temporary-colors.html removed after rename");
  exists(path.join(tokenDocsDir, "renamed-colors.html"))
    ? ok("renamed-colors.html generated")
    : fail("renamed-colors.html generated");
  exists(path.join(tokenDocsDir, "manual.html"))
    ? ok("hand-authored manual.html preserved (no marker)")
    : fail("hand-authored manual.html preserved (no marker)");
  // Stale page no longer in the built library index.
  !read(path.join(dir, "dist/swatchkit/index.html")).includes("Temporary Colors")
    ? ok("stale 'Temporary Colors' gone from library index")
    : fail("stale 'Temporary Colors' gone from library index");
}

// 15. Token docs merge matching type+label blocks, keep duplicate rows, and
//     resolve different-type label collisions with type-prefixed slugs.
{
  console.log("\n[15] Token docs merge matching labels and use type-prefixed collisions");
  const dir = freshDir("15-token-doc-merge");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  const tokensCss = path.join(dir, "src/css/global/tokens.css");
  const tokenDocsDir = path.join(dir, "swatchkit/tokens");
  fs.writeFileSync(
    tokensCss,
    `:root {
  /* @swatchkit colors "Default" */
  --color-a: red;
  --color-primary: red;
  /* @swatchkit end */

  /* @swatchkit colors "Default" */
  --color-b: blue;
  --color-primary: blue;
  /* @swatchkit end */

  /* @swatchkit spacing "Default" */
  --space-a: 1rem;
  /* @swatchkit end */
}
`,
  );
  fs.mkdirSync(tokenDocsDir, { recursive: true });
  fs.writeFileSync(
    path.join(tokenDocsDir, "default-2.html"),
    "<!-- @swatchkit generated-token-doc -->\n<p>stale generated doc</p>",
  );
  fs.writeFileSync(path.join(tokenDocsDir, "manual-token.html"), "<p>manual</p>");

  runSwatchkit("build", dir, []);

  const defaultDoc = path.join(tokenDocsDir, "default.html");
  const spacingDefaultDoc = path.join(tokenDocsDir, "spacing-default.html");
  const defaultDocContent = read(defaultDoc);
  exists(defaultDoc) ? ok("same type+label colors merged into default.html") : fail("same type+label colors merged into default.html");
  !exists(path.join(tokenDocsDir, "colors-default.html")) ? ok("no type prefix without collision for first label") : fail("no type prefix without collision for first label");
  !exists(path.join(tokenDocsDir, "default-2.html")) ? ok("stale numeric collision doc removed") : fail("stale numeric collision doc removed");
  exists(spacingDefaultDoc) ? ok("different type same label uses spacing-default.html") : fail("different type same label uses spacing-default.html");
  exists(path.join(tokenDocsDir, "manual-token.html")) ? ok("hand-authored token doc preserved") : fail("hand-authored token doc preserved");

  defaultDocContent.indexOf("color-a") < defaultDocContent.indexOf("color-b")
    ? ok("merged token docs preserve parse order")
    : fail("merged token docs preserve parse order");
  defaultDocContent.includes("red") && defaultDocContent.includes("blue")
    ? ok("duplicate token names remain visible as duplicate rows")
    : fail("duplicate token names remain visible as duplicate rows");

  const util = read(path.join(dir, "src/css/utilities/utilities.css"));
  const colorUtilityCount = (util.match(/\.color\\:color-primary \{/g) || []).length;
  const bgUtilityCount = (util.match(/\.background-color\\:color-primary \{/g) || []).length;
  colorUtilityCount === 1 ? ok("duplicate color utility deduped") : fail("duplicate color utility deduped", `got ${colorUtilityCount}`);
  bgUtilityCount === 1 ? ok("duplicate background-color utility deduped") : fail("duplicate background-color utility deduped", `got ${bgUtilityCount}`);
}

// 16. tokenBlocks controls token outputs; tokenDocs controls presentation only.
{
  console.log("\n[16] tokenBlocks controls docs/utilities; tokenDocs controls presentation");
  const dir = freshDir("16-token-docs-config");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  cssCopy: true,
  tokenBlocks: {
    colors: {
      docs: { includeLabels: "Colors" },
    },
    spacing: {
      docs: { includeLabels: [] },
    },
    textSizes: {
      labels: {
        "Text Sizes": { utilities: false },
      },
    },
  },
  tokenDocs: {
    colors: {
      columns: ["name", "value", "customProperty"],
      columnLabels: { customProperty: "CSS variable" },
    },
  },
};
`,
  );

  runSwatchkit("build", dir, []);

  const index = read(path.join(dir, "dist/swatchkit/index.html"));
  const tokenSection = index.slice(
    index.indexOf('id="colors"'),
    index.indexOf("</section>", index.indexOf('id="colors"')),
  );
  !tokenSection.includes("View source")
    ? ok("generated token docs hide source by default")
    : fail("generated token docs hide source by default");
  exists(path.join(dir, "dist/swatchkit/preview/tokens/colors/index.html"))
    ? ok("included color token doc generated")
    : fail("included color token doc generated");
  !exists(path.join(dir, "dist/swatchkit/preview/tokens/spacing/index.html"))
    ? ok("disabled spacing token doc omitted")
    : fail("disabled spacing token doc omitted");
  !index.includes("Color Utility Class") && !index.includes("BG Utility Class")
    ? ok("color utility columns omitted from library source block")
    : fail("color utility columns omitted from library source block");

  const colorPreview = read(path.join(dir, "dist/swatchkit/preview/tokens/colors/index.html"));
  colorPreview.includes("CSS variable")
    ? ok("color column label override applied")
    : fail("color column label override applied");
  !colorPreview.includes("Color Utility Class") && !colorPreview.includes("BG Utility Class")
    ? ok("color utility columns omitted from token preview")
    : fail("color utility columns omitted from token preview");

  const util = read(path.join(dir, "src/css/utilities/utilities.css"));
  util.includes(".padding-block\\:space-xs")
    ? ok("utilities still generated for hidden spacing docs")
    : fail("utilities still generated for hidden spacing docs");
  !util.includes(".font-size\\:step-0")
    ? ok("utilities omitted for tokenBlocks utilities:false")
    : fail("utilities omitted for tokenBlocks utilities:false");

  const textSizesPreview = read(path.join(dir, "dist/swatchkit/preview/tokens/text-sizes/index.html"));
  textSizesPreview && !textSizesPreview.includes(".font-size:step-0")
    ? ok("token docs omit disabled utility examples")
    : fail("token docs omit disabled utility examples");

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  cssCopy: true,
  tokenBlocks: { colors: { docs: { includeLabels: ["Colors"] } } },
  tokenDocs: { showSource: true },
};
`,
  );
  runSwatchkit("build with source enabled", dir, []);
  const sourceEnabledIndex = read(path.join(dir, "dist/swatchkit/index.html"));
  const sourceEnabledTokenSection = sourceEnabledIndex.slice(
    sourceEnabledIndex.indexOf('id="colors"'),
    sourceEnabledIndex.indexOf("</section>", sourceEnabledIndex.indexOf('id="colors"')),
  );
  sourceEnabledTokenSection.includes("View source")
    ? ok("tokenDocs.showSource re-enables source")
    : fail("tokenDocs.showSource re-enables source");
}

// 17. order config controls sections and swatches after excludes/filters.
{
  console.log("\n[17] order config controls section and swatch order");
  const dir = freshDir("17-order-config");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  const tokensCss = path.join(dir, "src/css/global/tokens.css");
  fs.appendFileSync(
    tokensCss,
    '\n:root {\n  /* @swatchkit colors "Aries Brand Colors" */\n  --aries-brand: #123456;\n  /* @swatchkit end */\n  /* @swatchkit colors "Alternate Colors" */\n  --alternate-brand: #abcdef;\n  /* @swatchkit end */\n}\n',
  );

  const compositionsDir = path.join(dir, "swatchkit/compositions");
  fs.mkdirSync(path.join(compositionsDir, "zeta"), { recursive: true });
  fs.writeFileSync(path.join(compositionsDir, "zeta/index.html"), "<p>Zeta</p>");
  fs.mkdirSync(path.join(compositionsDir, "alpha"), { recursive: true });
  fs.writeFileSync(path.join(compositionsDir, "alpha/index.html"), "<p>Alpha</p>");
  fs.mkdirSync(path.join(compositionsDir, "hidden"), { recursive: true });
  fs.writeFileSync(path.join(compositionsDir, "hidden/index.html"), "<p>Hidden</p>");

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  cssCopy: true,
  exclude: ["hidden"],
  order: {
    sections: ["compositions", "tokens", "missing-section"],
    swatches: {
      tokens: ["aries-brand-colors", "missing-token"],
      compositions: ["zeta", "hidden"],
    },
  },
};
`,
  );

  runSwatchkit("build", dir, []);
  const index = read(path.join(dir, "dist/swatchkit/index.html"));

  index.indexOf("Compositions") < index.indexOf("Design Tokens")
    ? ok("order.sections puts compositions before tokens")
    : fail("order.sections puts compositions before tokens");

  const tokenSidebar = index.slice(
    index.indexOf("Design Tokens"),
    index.indexOf("Patterns", index.indexOf("Design Tokens")),
  );
  tokenSidebar.indexOf('href="#aries-brand-colors"') < tokenSidebar.indexOf('href="#alternate-colors"') &&
    tokenSidebar.indexOf('href="#alternate-colors"') < tokenSidebar.indexOf('href="#colors"') &&
    tokenSidebar.indexOf('href="#colors"') < tokenSidebar.indexOf('href="#fonts"')
    ? ok("order.swatches.tokens pins Aries then sorts unlisted token docs")
    : fail("order.swatches.tokens pins Aries then sorts unlisted token docs");

  const compositionsSidebar = index.slice(
    index.indexOf("Compositions"),
    index.indexOf("Design Tokens"),
  );
  compositionsSidebar.indexOf("Zeta") < compositionsSidebar.indexOf("Alpha")
    ? ok("order.swatches.compositions pins zeta before alpha")
    : fail("order.swatches.compositions pins zeta before alpha");
  !compositionsSidebar.includes("Hidden")
    ? ok("exclude still wins over order")
    : fail("exclude still wins over order");
}

// 18. v6 config validation fails fast for removed/invalid token output config.
{
  console.log("\n[18] v6 token output config validation");
  const dir = freshDir("18-v6-config-validation");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  tokenDocs: { colors: { includeLabels: ["Colors"] } },
};
`,
  );
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
    fail("removed tokenDocs includeLabels errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("tokenDocs.colors.includeLabels was removed in v6")
      ? ok("removed tokenDocs includeLabels errors")
      : fail("removed tokenDocs includeLabels errors", (e.stderr || e.stdout || e.message).toString());
  }

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  tokenBlocks: { textSizes: {}, "text-sizes": {} },
};
`,
  );
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
    fail("tokenBlocks alias collision errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes('tokenBlocks defines both "textSizes" and "text-sizes"')
      ? ok("tokenBlocks alias collision errors")
      : fail("tokenBlocks alias collision errors", (e.stderr || e.stdout || e.message).toString());
  }

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  cssDir: "./src/css",
  tokenBlocks: { viewports: { labels: { Viewports: { utilities: true } } } },
};
`,
  );
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
    fail("viewports utilities:true errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("viewports does not generate utilities")
      ? ok("viewports utilities:true errors")
      : fail("viewports utilities:true errors", (e.stderr || e.stdout || e.message).toString());
  }
}

// 19. SwatchKit client script and view-transition assets.
{
  console.log("\n[19] SwatchKit client script and View Transition assets");
  const dir = freshDir("19-view-transitions");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  const rootSwatch = path.join(dir, "swatchkit", "root-preview.html");
  fs.writeFileSync(rootSwatch, "<button>Root preview</button>\n");
  runSwatchkit("build", dir, []);

  exists(path.join(dir, "swatchkit/swatchkit.js"))
    ? ok("swatchkit/swatchkit.js scaffolded")
    : fail("swatchkit/swatchkit.js scaffolded");
  exists(path.join(dir, "dist/swatchkit/js/swatchkit.js"))
    ? ok("dist/swatchkit/js/swatchkit.js copied")
    : fail("dist/swatchkit/js/swatchkit.js copied");

  const index = read(path.join(dir, "dist/swatchkit/index.html"));
  index.includes('<script src="js/swatchkit.js"></script>')
    ? ok("main index references swatchkit.js")
    : fail("main index references swatchkit.js");

  const rootPreview = read(path.join(dir, "dist/swatchkit/preview/root-preview/index.html"));
  rootPreview.includes('<script src="../../js/swatchkit.js"></script>')
    ? ok("root preview references swatchkit.js at correct depth")
    : fail("root preview references swatchkit.js at correct depth");

  const sectionPreview = read(path.join(dir, "dist/swatchkit/preview/swatches/hello/index.html"));
  sectionPreview.includes('<script src="../../../js/swatchkit.js"></script>')
    ? ok("section preview references swatchkit.js at correct depth")
    : fail("section preview references swatchkit.js at correct depth");

  const uiCss = read(path.join(dir, "dist/swatchkit/css/swatchkit-ui.css"));
  uiCss.includes("@view-transition") && uiCss.includes("::view-transition-new(preview)")
    ? ok("SwatchKit UI CSS includes View Transition rules")
    : fail("SwatchKit UI CSS includes View Transition rules");

  const previewCss = read(path.join(dir, "dist/swatchkit/css/swatchkit-preview.css"));
  previewCss.includes("view-transition-name: preview")
    ? ok("SwatchKit preview CSS tags preview body")
    : fail("SwatchKit preview CSS tags preview body");
}

// 20. Integrated app mode still emits the SwatchKit client script internally.
{
  console.log("\n[20] init --app emits SwatchKit client script");
  const dir = freshDir("20-app-view-transitions");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init --app", dir, ["init", "--app", "--cssDir", "./src/css"]);
  runSwatchkit("build:swatchkit", dir, []);

  exists(path.join(dir, "swatchkit/swatchkit.js"))
    ? ok("app mode scaffolds swatchkit/swatchkit.js")
    : fail("app mode scaffolds swatchkit/swatchkit.js");
  exists(path.join(dir, "dist/swatchkit/js/swatchkit.js"))
    ? ok("app mode copies dist/swatchkit/js/swatchkit.js")
    : fail("app mode copies dist/swatchkit/js/swatchkit.js");

  const index = read(path.join(dir, "dist/swatchkit/index.html"));
  index.includes('<script src="js/swatchkit.js"></script>')
    ? ok("app mode main index references swatchkit.js")
    : fail("app mode main index references swatchkit.js");

  const sectionPreview = read(path.join(dir, "dist/swatchkit/preview/swatches/button/index.html"));
  sectionPreview.includes('<script src="../../../js/swatchkit.js"></script>')
    ? ok("app mode preview references swatchkit.js at correct depth")
    : fail("app mode preview references swatchkit.js at correct depth");
}

// 21. Standalone init outputs SwatchKit at the hosted root.
{
  console.log("\n[21] init --standalone outputs SwatchKit at dist root");
  const dir = freshDir("21-standalone-root-output");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init --standalone", dir, ["init", "--standalone", "--cssDir", "./src/css"]);

  const cfg = read(path.join(dir, "swatchkit.config.js"));
  cfg.includes('outDir: "./dist"') && cfg.includes("allowRootOutDir: true") && cfg.includes("cssCopy: true")
    ? ok("standalone config writes root dist output and copies CSS")
    : fail("standalone config writes root dist output and copies CSS");

  const pkg = JSON.parse(read(path.join(dir, "package.json")));
  pkg.type === "module"
    ? ok("standalone package.json is ESM for JS swatches")
    : fail("standalone package.json is ESM for JS swatches");
  pkg.scripts?.build === "swatchkit" &&
    pkg.scripts?.watch === "swatchkit --watch" &&
    pkg.scripts?.serve === "http-server dist -c-1 -o /" &&
    pkg.scripts?.dev === "npm run build && npm-run-all --parallel watch serve"
    ? ok("standalone package.json has build/watch/serve/dev scripts")
    : fail("standalone package.json has build/watch/serve/dev scripts");
  pkg.devDependencies?.["http-server"] && pkg.devDependencies?.["npm-run-all"] && pkg.devDependencies?.swatchkit
    ? ok("standalone package.json has dev dependencies")
    : fail("standalone package.json has dev dependencies");

  exists(path.join(dir, "src/components/button.js")) &&
    exists(path.join(dir, "src/components/card.js")) &&
    exists(path.join(dir, "swatchkit/swatches/button/index.js")) &&
    exists(path.join(dir, "swatchkit/swatches/card/index.js"))
    ? ok("standalone scaffolds render-function component examples")
    : fail("standalone scaffolds render-function component examples");
  read(path.join(dir, "src/css/swatches/index.css")).includes('@import "button.css";') &&
    read(path.join(dir, "src/css/swatches/index.css")).includes('@import "card.css";')
    ? ok("standalone registers button/card CSS")
    : fail("standalone registers button/card CSS");

  runSwatchkit("build", dir, []);

  exists(path.join(dir, "dist/index.html"))
    ? ok("standalone dist/index.html generated")
    : fail("standalone dist/index.html generated");
  exists(path.join(dir, "dist/preview/swatches/hello/index.html"))
    ? ok("standalone preview generated under dist/preview")
    : fail("standalone preview generated under dist/preview");
  exists(path.join(dir, "dist/preview/swatches/button/index.html")) &&
    exists(path.join(dir, "dist/preview/swatches/card/index.html"))
    ? ok("standalone button/card previews generated")
    : fail("standalone button/card previews generated");
  exists(path.join(dir, "dist/css/main.css"))
    ? ok("standalone CSS copied into dist/css")
    : fail("standalone CSS copied into dist/css");
  exists(path.join(dir, "dist/js/swatchkit.js"))
    ? ok("standalone swatchkit.js copied into dist/js")
    : fail("standalone swatchkit.js copied into dist/js");
  !exists(path.join(dir, "dist/swatchkit/index.html"))
    ? ok("standalone does not generate nested dist/swatchkit app")
    : fail("standalone does not generate nested dist/swatchkit app");

  const index = read(path.join(dir, "dist/index.html"));
  index.includes('href="css/main.css"') &&
    index.includes('src="js/swatchkit.js"') &&
    index.includes('src="preview/swatches/hello/"')
    ? ok("standalone index uses root-relative local asset and preview links")
    : fail("standalone index uses root-relative local asset and preview links");

  const preview = read(path.join(dir, "dist/preview/swatches/hello/index.html"));
  preview.includes('href="../../../css/main.css"') &&
    preview.includes('src="../../../js/swatchkit.js"')
    ? ok("standalone preview uses correct depth-aware asset links")
    : fail("standalone preview uses correct depth-aware asset links");

  read(path.join(dir, "dist/preview/swatches/button/index.html")).includes("Primary") &&
    read(path.join(dir, "dist/preview/swatches/card/index.html")).includes("Project Aurora")
    ? ok("standalone JS render-function examples render to preview HTML")
    : fail("standalone JS render-function examples render to preview HTML");
}

// 22. Shallow outDir requires explicit allowRootOutDir safety opt-in.
{
  console.log("\n[22] shallow outDir validation");
  const dir = freshDir("22-shallow-outdir-validation");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("init", dir, ["init", "--cssDir", "./src/css"]);

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  outDir: "./dist",
  cssDir: "./src/css",
  cssCopy: true,
};
`,
  );
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
    fail("outDir ./dist without allowRootOutDir errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("allowRootOutDir: true")
      ? ok("outDir ./dist without allowRootOutDir errors")
      : fail("outDir ./dist without allowRootOutDir errors", (e.stderr || e.stdout || e.message).toString());
  }

  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    `export default {
  outDir: ".",
  cssDir: "./src/css",
  cssCopy: true,
  allowRootOutDir: true,
};
`,
  );
  try {
    execSync(`node "${SWATCHKIT}"`, { cwd: dir, stdio: "pipe" });
    fail("outDir project root errors even with allowRootOutDir");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("not the project root")
      ? ok("outDir project root errors even with allowRootOutDir")
      : fail("outDir project root errors even with allowRootOutDir", (e.stderr || e.stdout || e.message).toString());
  }
}

// 23. --app and --standalone are intentionally separate starters.
{
  console.log("\n[23] init --app --standalone fails clearly");
  const dir = freshDir("23-app-standalone-conflict");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  try {
    execSync(`node "${SWATCHKIT}" "init" "--app" "--standalone" "--cssDir" "./src/css"`, {
      cwd: dir,
      stdio: "pipe",
    });
    fail("init --app --standalone errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("separate starters")
      ? ok("init --app --standalone errors")
      : fail("init --app --standalone errors", (e.stderr || e.stdout || e.message).toString());
  }

  try {
    execSync(`node "${SWATCHKIT}" "--standalone"`, {
      cwd: dir,
      stdio: "pipe",
    });
    fail("--standalone without init errors");
  } catch (e) {
    (e.stderr || e.stdout || e.message).toString().includes("--standalone is only supported with init")
      ? ok("--standalone without init errors")
      : fail("--standalone without init errors", (e.stderr || e.stdout || e.message).toString());
  }
}

// Cleanup
fs.rmSync(TMP_ROOT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
