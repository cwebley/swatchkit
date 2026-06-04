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

// 1. ESM project, swatchkit new + scaffold + build
{
  console.log("\n[1] ESM project, swatchkit new (--cssDir ./src/css)");
  const dir = freshDir("1-esm-new");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  runSwatchkit("new", dir, ["new", "--cssDir", "./src/css"]);
  runSwatchkit("scaffold", dir, ["scaffold"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "src/css/main.css")) ? ok("src/css/main.css exists") : fail("src/css/main.css exists");
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir", "found css/ at project root") : ok("no stray root css/ dir");
}

// 2. CJS project, swatchkit new + scaffold + build
{
  console.log("\n[2] CJS project, swatchkit new (--cssDir ./src/css)");
  const dir = freshDir("2-cjs-new");
  fs.writeFileSync(path.join(dir, "package.json"), CJS_PKG);
  runSwatchkit("new", dir, ["new", "--cssDir", "./src/css"]);
  runSwatchkit("scaffold", dir, ["scaffold"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "src/css/main.css")) ? ok("src/css/main.css exists") : fail("src/css/main.css exists");
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir") : ok("no stray root css/ dir");
}

// 3. ESM project, hand-written export default config
//    (this is the exact regression: Node 22 returns a Module namespace
//    from require() of an ESM file. Without .default unwrap, cssDir
//    silently falls back to ./css and the build writes to the wrong place.)
{
  console.log("\n[3] ESM project, hand-written export default config (the regression case)");
  const dir = freshDir("3-esm-export");
  fs.writeFileSync(path.join(dir, "package.json"), ESM_PKG);
  fs.writeFileSync(
    path.join(dir, "swatchkit.config.js"),
    'export default { cssDir: "./src/css", cssCopy: true };\n',
  );
  runSwatchkit("scaffold", dir, ["scaffold"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists (regression: must NOT be missing)") : fail("dist/swatchkit/css/main.css exists");
  exists(path.join(dir, "css")) ? fail("no stray root css/ dir") : ok("no stray root css/ dir");
  // Tokens should have been written to src/css, not root css/
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
  runSwatchkit("scaffold", dir, ["scaffold"]);
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
  runSwatchkit("scaffold", dir, ["scaffold"]);
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
  runSwatchkit("scaffold", dir, ["scaffold"]);
  runSwatchkit("build", dir, []);
  exists(path.join(dir, "dist/swatchkit/css/main.css")) ? ok("dist/swatchkit/css/main.css exists") : fail("dist/swatchkit/css/main.css exists");
}

// Cleanup
fs.rmSync(TMP_ROOT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
