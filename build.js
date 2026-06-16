#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const chokidar = require("chokidar");
const { parseTokenBlocks } = require("./src/token-parser");
const {
  generateUtilities,
  generateTokenDocs,
  mergeTokenBlocksByTypeAndLabel,
  filterTokenDocBlocks,
} = require("./src/generators");

/**
 * SwatchKit Build Script
 * Refactored for Phase 1 Expansion
 */

// --- 1. CLI Argument Parsing ---
function parseArgs(args) {
  const options = {
    command: null,
    watch: false,
    config: null,
    input: null,
    outDir: null,
    cssDir: null,
    force: false,
    dryRun: false,
    app: false,
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "init") {
      options.command = "init";
    } else if (arg === "--app") {
      options.app = true;
    } else if (arg === "-w" || arg === "--watch") {
      options.watch = true;
    } else if (arg === "-h" || arg === "--help") {
      options.command = "help";
    } else if (arg === "-v" || arg === "--version") {
      options.command = "version";
    } else if (arg === "-f" || arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-c" || arg === "--config") {
      // Handle case where flag is last arg
      if (i + 1 < args.length) {
        options.config = args[++i];
      }
    } else if (arg === "-i" || arg === "--input") {
      if (i + 1 < args.length) {
        options.input = args[++i];
      }
    } else if (arg === "-o" || arg === "--outDir") {
      if (i + 1 < args.length) {
        options.outDir = args[++i];
      }
    } else if (arg === "--cssDir") {
      if (i + 1 < args.length) {
        options.cssDir = args[++i];
      }
    }
  }
  return options;
}

// --- 2. Config Loading ---
const CONFIG_FILES = [
  "swatchkit.config.cjs",
  "swatchkit.config.mjs",
  "swatchkit.config.js",
];

function findConfigPath(searchPath) {
  if (searchPath) {
    const resolved = path.resolve(process.cwd(), searchPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  for (const filename of CONFIG_FILES) {
    const candidate = path.join(process.cwd(), filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Unwrap a config export to a plain config object.
// In Node 22+, require() of an ESM file returns a Module namespace
// ({ default: { ...config } }) instead of throwing. Without unwrapping
// .default, fileConfig.cssDir would be undefined and SwatchKit would
// silently fall back to the default cssDir.
function normalizeConfigExport(config) {
  if (
    config &&
    typeof config === "object" &&
    "default" in config &&
    typeof config.default === "object"
  ) {
    return config.default;
  }

  return config || {};
}

async function loadConfig(configPath) {
  const finalPath = findConfigPath(configPath);

  if (!finalPath) {
    return {};
  }

  console.log(`[SwatchKit] Loading config from ${finalPath}`);

  if (finalPath.endsWith(".cjs")) {
    return normalizeConfigExport(require(finalPath));
  }

  if (finalPath.endsWith(".mjs")) {
    const { pathToFileURL } = require("url");
    const url = pathToFileURL(finalPath).href + "?t=" + Date.now();
    const mod = await import(url);
    return normalizeConfigExport(mod);
  }

  // .js: try require first, fall back to dynamic import for ESM projects.
  // On Node 22+, require() of an ESM file succeeds and returns a namespace,
  // so normalizeConfigExport unwraps .default either way.
  try {
    return normalizeConfigExport(require(finalPath));
  } catch (requireError) {
    if (requireError.message.includes("module is not defined")) {
      try {
        const { pathToFileURL } = require("url");
        const url = pathToFileURL(finalPath).href + "?t=" + Date.now();
        const mod = await import(url);
        if (mod.default && typeof mod.default === "object") {
          return mod.default;
        }
        throw new Error("Config must use 'export default' syntax in ESM projects.");
      } catch (importError) {
        throw new Error(
          `[SwatchKit] Could not load config.\n\n` +
          `If your project uses "type": "module", use ESM syntax:\n\n` +
          `  // swatchkit.config.js\n` +
          `  export default {\n` +
          `    cssDir: "./css"\n` +
          `  };\n\n` +
          `Or rename to .cjs for CommonJS syntax:\n\n` +
          `  // swatchkit.config.cjs\n` +
          `  module.exports = {\n` +
          `    cssDir: "./css"\n` +
          `  };`
        );
      }
    }
    throw requireError;
  }
}

// Detect whether the project is an ESM package (has "type": "module"
// in its package.json). Used by `swatchkit new` to generate the right
// config syntax.
function projectUsesEsm(cwd = process.cwd()) {
  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) return false;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.type === "module";
  } catch {
    return false;
  }
}

// Ensure package.json exists and is ESM ("type": "module"). Used by
// `init --app`, whose starter (config + build scripts) is ESM. This MUST run
// before the ESM swatchkit.config.js is written/loaded, otherwise Node loads
// the config as CommonJS and fails with "Unexpected token 'export'".
// Returns true if it created or modified package.json.
function ensureEsmPackageJson(cwd = process.cwd()) {
  const packageJsonPath = path.join(cwd, "package.json");
  let pkg = {};
  let existed = false;
  if (fs.existsSync(packageJsonPath)) {
    existed = true;
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    } catch {
      // Leave an unparseable package.json untouched; warn instead.
      console.warn(
        "[SwatchKit] Could not parse package.json — please add '\"type\": \"module\"' yourself.",
      );
      return false;
    }
  }
  if (pkg.type === "module") return false;

  pkg.name = pkg.name || path.basename(cwd);
  pkg.version = pkg.version || "1.0.0";
  pkg.private = pkg.private !== undefined ? pkg.private : true;
  pkg.type = "module";
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(
    `  ${existed ? "~ Updated" : "+ Created"}: package.json ("type": "module")`,
  );
  return true;
}

// --- 2.5 Glob Matching Helper ---
function matchesGlob(filename, pattern) {
  // Simple wildcard support
  if (pattern.includes("*")) {
    const parts = pattern.split("*");
    // Handle "foo*"
    if (pattern.endsWith("*") && !pattern.startsWith("*")) {
      return filename.startsWith(parts[0]);
    }
    // Handle "*bar"
    if (pattern.startsWith("*") && !pattern.endsWith("*")) {
      return filename.endsWith(parts[1]);
    }
    // Handle "*bar*"
    if (pattern.startsWith("*") && pattern.endsWith("*")) {
      return filename.includes(parts[1]);
    }
  }
  return filename === pattern;
}

function toTitleCase(str) {
  return str.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function categorySlug(category) {
  if (category === "Design Tokens") return "tokens";
  if (category === "Patterns") return "patterns";
  return category.toLowerCase().replace(/\s+/g, "-");
}

function applyConfiguredOrder(items, orderedSlugs, getSlug, getLabel) {
  if (!Array.isArray(orderedSlugs)) return items;

  const rank = new Map(orderedSlugs.map((slug, index) => [slug, index]));
  return items.slice().sort((a, b) => {
    const aRank = rank.has(getSlug(a)) ? rank.get(getSlug(a)) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(getSlug(b)) ? rank.get(getSlug(b)) : Number.MAX_SAFE_INTEGER;

    if (aRank !== bRank) return aRank - bRank;
    return getLabel(a).localeCompare(getLabel(b));
  });
}

function defaultSectionSort(a, b) {
  if (a === "Design Tokens") return -1;
  if (b === "Design Tokens") return 1;
  if (a === "Patterns") return 1;
  if (b === "Patterns") return -1;
  return a.localeCompare(b);
}

const defaultRenderers = {
  renderSidebarSection: ({ category, categorySlug, items }) => {
    return `<h2>${category}</h2>
<ul role="list">
${items.map(p => `  <li><a href="#${p.slug}">${p.name}</a></li>`).join("\n")}
</ul>`;
  },

  renderSwatchSection: ({
    slug,
    name,
    category,
    categorySlug,
    description,
    previewHref,
    escapedContent,
    showSource = true,
  }) => {
    return `
<section id="${slug}" class="region flow">
  <h2>${name} <small style="font-weight: normal; opacity: 0.6; font-size: 0.7em">(${category})</small></h2>
  ${description ? `<div class="swatch-description">${description}</div>` : ""}
  <iframe src="${previewHref}" style="width: 100%; border: var(--stroke); min-height: 25rem; resize: auto; overflow: auto;"></iframe>
  <a href="${previewHref}">View full screen</a>
  ${showSource ? `<details>
    <summary>View source</summary>
    <pre><code>${escapedContent}</code></pre>
  </details>` : ""}
</section>`;
  },
};

// --- 3. Smart Defaults & Path Resolution ---
function resolveSettings(cliOptions, fileConfig) {
  const cwd = process.cwd();

  // Helper to find patterns dir
  function findSwatchkitDir() {
    // 1. Explicit input
    if (cliOptions.input) return path.resolve(cwd, cliOptions.input);
    if (fileConfig.input) return path.resolve(cwd, fileConfig.input);

    // 2. Default
    return path.join(cwd, "swatchkit");
  }

  const swatchkitDir = findSwatchkitDir();

  // Output Dir
  // Default: dist/swatchkit
  const outDir = cliOptions.outDir
    ? path.resolve(cwd, cliOptions.outDir)
    : fileConfig.outDir
      ? path.resolve(cwd, fileConfig.outDir)
      : path.join(cwd, "dist/swatchkit");

  // CSS directory - where tokens.css and user's main.css live
  // Default: css/ at project root
  const cssDir = fileConfig.cssDir
    ? path.resolve(cwd, fileConfig.cssDir)
    : path.join(cwd, "css");

  // Token sources (v5): CSS files that may contain @swatchkit token blocks.
  // Default: the scaffolded global/tokens.css, plus the conventional
  // tokens.css / tokens/*.css locations inside cssDir. Users add theme files
  // explicitly (e.g. a Nova theme) when needed.
  const cssDirRel = path.relative(cwd, cssDir) || ".";
  const tokenSources =
    fileConfig.tokenSources ||
    [
      `${cssDirRel}/global/tokens.css`,
      `${cssDirRel}/tokens.css`,
      `${cssDirRel}/tokens/*.css`,
    ];

  // Exclude patterns
  const exclude = fileConfig.exclude || [];

  // CSS copy behavior
  // When true (default), copies cssDir into outDir/css/ for a self-contained build.
  // When false, skips the copy — expects CSS to already exist at cssPath relative to output.
  const cssCopy = fileConfig.cssCopy !== undefined ? fileConfig.cssCopy : true;

  // Relative path from SwatchKit HTML output to the user's CSS directory.
  // Only used when cssCopy is false. Derived from cssDir basename by default
  // (e.g., cssDir: "./src/css" -> "../css/", cssDir: "./styles" -> "../styles/").
  const cssPath =
    fileConfig.cssPath || (cssCopy ? "css/" : `../${path.basename(cssDir)}/`);

  // Render callbacks - merge user config with defaults
  const renderSidebarSection =
    fileConfig.renderSidebarSection || defaultRenderers.renderSidebarSection;
  const renderSwatchSection =
    fileConfig.renderSwatchSection || defaultRenderers.renderSwatchSection;

  const tokenDocs = fileConfig.tokenDocs || {};
  const order = fileConfig.order || {};

  return {
    swatchkitDir,
    outDir,
    cssDir,
    tokenSources,
    exclude,
    cssCopy,
    cssPath,
    tokenDocs,
    order,
    fileConfig, // Expose config to init
    // Internal layout templates (relative to this script)
    internalLayout: path.join(__dirname, "src/swatchkit.html"),
    internalPreviewLayout: path.join(__dirname, "src/preview-layout.html"),
    // Project specific layout overrides
    projectLayout: path.join(swatchkitDir, "_swatchkit.html"),
    projectPreviewLayout: path.join(swatchkitDir, "_preview.html"),

    // Derived paths
    distCssDir: path.join(outDir, "css"),
    distPreviewDir: path.join(outDir, "preview"),
    outputFile: path.join(outDir, "index.html"),
    utilitiesDir: path.join(cssDir, "utilities"),
    mainCssFile: path.join(cssDir, "main.css"),
    // Render callbacks
    renderSidebarSection,
    renderSwatchSection,
  };
}

// --- 4. Init Manifest & Dry Run ---

// Builds a list of all files that init manages.
// Each entry maps a blueprint source to a project destination.
// Used by both the actual init and the dry-run status report.
// Returns the next available backup path for a file.
// e.g. foo.css → foo.css.bak, then foo.css.bak2, foo.css.bak3, etc.
function getBackupPath(filePath) {
  const candidate = `${filePath}.bak`;
  if (!fs.existsSync(candidate)) return candidate;
  let i = 2;
  while (fs.existsSync(`${filePath}.bak${i}`)) i++;
  return `${filePath}.bak${i}`;
}

function buildInitManifest(settings) {
  const manifest = [];
  const blueprintsDir = path.join(__dirname, "src/blueprints");
  const templatesDir = path.join(__dirname, "src/templates");

  // Hello swatch (default example in swatchkit/swatches/hello/)
  for (const file of ["index.html", "README.md"]) {
    manifest.push({
      src: path.join(templatesDir, "hello", file),
      dest: path.join(settings.swatchkitDir, "swatches", "hello", file),
    });
  }

  // Swatches CSS folder (css/swatches/)
  for (const file of ["index.css", "hello.css"]) {
    manifest.push({
      src: path.join(blueprintsDir, "swatches", file),
      dest: path.join(settings.cssDir, "swatches", file),
    });
  }

  // Utility and composition display templates — walk each subfolder
  for (const section of ["utilities", "compositions"]) {
    const sectionSrc = path.join(templatesDir, section);
    if (!fs.existsSync(sectionSrc)) continue;
    const folders = fs
      .readdirSync(sectionSrc)
      .filter((f) => fs.statSync(path.join(sectionSrc, f)).isDirectory());
    for (const folder of folders) {
      const folderSrc = path.join(sectionSrc, folder);
      const files = fs
        .readdirSync(folderSrc)
        .filter((f) => f.endsWith(".html"));
      for (const file of files) {
        manifest.push({
          src: path.join(folderSrc, file),
          dest: path.join(settings.swatchkitDir, section, folder, file),
          transform: (content) => content.trim(),
        });
      }
    }
  }

  // CSS entry point
  manifest.push({
    src: path.join(blueprintsDir, "main.css"),
    dest: settings.mainCssFile,
  });

  // SwatchKit UI styles
  manifest.push({
    src: path.join(blueprintsDir, "swatchkit-ui.css"),
    dest: path.join(settings.cssDir, "swatchkit-ui.css"),
  });

  // SwatchKit preview styles (loaded only by preview pages)
  manifest.push({
    src: path.join(blueprintsDir, "swatchkit-preview.css"),
    dest: path.join(settings.cssDir, "swatchkit-preview.css"),
  });

  // CSS folder blueprints (global, compositions, utilities)
  const cssFolders = ["global", "compositions", "utilities"];
  for (const folder of cssFolders) {
    const srcDir = path.join(blueprintsDir, folder);
    if (fs.existsSync(srcDir)) {
      const files = fs
        .readdirSync(srcDir)
        .filter((f) => !fs.statSync(path.join(srcDir, f)).isDirectory());
      for (const file of files) {
        manifest.push({
          src: path.join(srcDir, file),
          dest: path.join(settings.cssDir, folder, file),
        });
      }
    }
  }

  // Layout files
  manifest.push({
    src: settings.internalLayout,
    dest: settings.projectLayout,
  });
  manifest.push({
    src: settings.internalPreviewLayout,
    dest: settings.projectPreviewLayout,
  });

  return manifest;
}

// Directories that init ensures exist.
function getInitDirs(settings) {
  return [
    settings.swatchkitDir,
    path.join(settings.swatchkitDir, "tokens"),
    path.join(settings.swatchkitDir, "utilities"),
    path.join(settings.swatchkitDir, "compositions"),
    path.join(settings.swatchkitDir, "swatches"),
    path.join(settings.swatchkitDir, "swatches", "hello"),
    settings.cssDir,
    path.join(settings.cssDir, "global"),
    path.join(settings.cssDir, "utilities"),
    path.join(settings.cssDir, "swatches"),
  ];
}

// Compare init-managed files against their blueprint sources and print a
// status report showing what would be created, changed, or is up to date.
function reportInitStatus(settings) {
  const cwd = process.cwd();
  const manifest = buildInitManifest(settings);
  const dirs = getInitDirs(settings);

  const newDirs = [];
  const created = [];
  const changed = [];
  const upToDate = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      newDirs.push(path.relative(cwd, dir) + "/");
    }
  }

  for (const entry of manifest) {
    const relDest = path.relative(cwd, entry.dest);
    if (!fs.existsSync(entry.dest)) {
      created.push(relDest);
    } else {
      let srcContent = fs.readFileSync(entry.src, "utf-8");
      if (entry.transform) srcContent = entry.transform(srcContent);
      const destContent = fs.readFileSync(entry.dest, "utf-8");
      if (srcContent !== destContent) {
        changed.push(relDest);
      } else {
        upToDate.push(relDest);
      }
    }
  }

  if (newDirs.length === 0 && created.length === 0 && changed.length === 0) {
    console.log("[SwatchKit] All init-managed files are up to date.");
    return;
  }

  if (newDirs.length > 0 || created.length > 0) {
    console.log("\n  New (will be created):");
    for (const d of newDirs) console.log(`    + ${d}`);
    for (const f of created) console.log(`    + ${f}`);
  }

  if (changed.length > 0) {
    console.log("\n  Changed (differs from latest blueprint):");
    for (const f of changed) console.log(`    ~ ${f}`);
  }

  if (upToDate.length > 0) {
    console.log("\n  Up to date:");
    for (const f of upToDate) console.log(`    = ${f}`);
  }

  console.log("");

  if (changed.length > 0 || created.length > 0 || newDirs.length > 0) {
    console.log(
      "  Run 'swatchkit init --force' to update all files to latest blueprints.\n",
    );
  }
}

// --- 5. Config Generation ---
function generateConfig(cssDir, app = false) {
  // App mode: integrated config (a build tool owns the CSS, so SwatchKit
  // references the shared stylesheet rather than copying it). The app starter
  // always sets "type": "module" in package.json, so the config is ESM.
  if (app) {
    const appBody = `{
  cssDir: "${cssDir}",

  // Integrated app: esbuild (scripts/build-assets.js) owns the CSS, so
  // SwatchKit references the shared stylesheet instead of copying it. Both the
  // app and the pattern library point at dist/css/main.css.
  cssCopy: false,
  cssPath: "../css/",
}`;
    return `// swatchkit.config.js\nexport default ${appBody};\n`;
  }

  const body = `{
  // Where your CSS lives. SwatchKit scaffolds blueprints here and reads
  // your @swatchkit token blocks from here when building the pattern library.
  cssDir: "${cssDir}",

  // Set to false if a build tool (Vite, Astro, Eleventy, etc.) is already
  // handling your CSS and you don't need SwatchKit to copy it.
  cssCopy: true,

  // CSS files scanned for @swatchkit token blocks (supports a trailing * glob).
  // Default: ["<cssDir>/global/tokens.css", "<cssDir>/tokens.css", "<cssDir>/tokens/*.css"].
  // Add theme files explicitly, e.g. ["${cssDir}/global/tokens.css", "${cssDir}/theme.css"].
  // tokenSources: ["${cssDir}/global/tokens.css", "${cssDir}/theme.css"],

  // Where the built pattern library is output.
  // outDir: "./dist/swatchkit",

  // Files or folders to exclude from the pattern library (supports globs).
  // exclude: [],

  // Control sidebar section order and swatch order inside each section.
  // Order lists are partial: listed slugs come first; unlisted items follow
  // alphabetically. Ordering runs after exclude and tokenDocs filters.
  // order: {
  //   sections: ["tokens", "components", "compositions", "utilities", "patterns"],
  //   swatches: {
  //     tokens: ["aries-brand-colors", "colors", "fonts"],
  //     components: ["button", "card"],
  //   },
  // },

  // Customize generated token documentation without changing your CSS markers.
  // Utilities are still generated for parsed tokens even when docs are hidden.
  // tokenDocs: {
  //   showSource: false, // generated token docs hide source by default
  //   colors: {
  //     columns: ["name", "value", "customProperty"],
  //     columnLabels: { customProperty: "CSS variable" },
  //     includeLabels: ["Brand Colors"],
  //     // excludeLabels: ["Internal Colors"],
  //   },
  //   spacing: { enabled: false },
  // },

  // Render callbacks for customizing generated markup.
  // If omitted, SwatchKit uses its default rendering.
  // renderSidebarSection: ({ category, categorySlug, items }) => string,
  // renderSwatchSection: ({ slug, name, category, categorySlug, description, previewHref, content, escapedContent, sourceKind, showSource }) => string,
}`;

  if (projectUsesEsm()) {
    return `// swatchkit.config.js
export default ${body};
`;
  }

  return `// swatchkit.config.js
module.exports = ${body};
`;
}

// Ensure swatchkit.config.js exists. Returns a promise resolving to the
// resolved cssDir (relative form, e.g. "./src/css"). If the config already
// exists, resolves with null (the caller keeps the existing settings).
function ensureConfig(cliOptions) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "swatchkit.config.js");

  const configExists = CONFIG_FILES.some((f) =>
    fs.existsSync(path.join(cwd, f)),
  );

  if (configExists && !cliOptions.force) {
    return Promise.resolve(null);
  }

  const writeConfig = (cssDir) => {
    if (fs.existsSync(configPath) && cliOptions.force) {
      const backupPath = getBackupPath(configPath);
      fs.copyFileSync(configPath, backupPath);
      console.log(
        `  ~ Backed up: swatchkit.config.js → ${path.basename(backupPath)}`,
      );
    }
    fs.writeFileSync(configPath, generateConfig(cssDir, cliOptions.app));
    console.log(
      `+ Created: swatchkit.config.js (cssDir: ${cssDir}${cliOptions.app ? ", integrated app" : ""})`,
    );
    return cssDir;
  };

  // Non-interactive: --cssDir provided.
  if (cliOptions.cssDir) {
    const cssDir = `./${cliOptions.cssDir.trim().replace(/^\.\//, "")}`;
    return Promise.resolve(writeConfig(cssDir));
  }

  // Interactive prompt.
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Where does your CSS live? [src/css]: ", (answer) => {
      rl.close();
      const cssDir = answer.trim()
        ? `./${answer.trim().replace(/^\.\//, "")}`
        : "./src/css";
      resolve(writeConfig(cssDir));
    });
  });
}

// --- 6. Init Command Logic (merged config + scaffold) ---
function scaffold(settings, options) {
  const isInitialized = fs.existsSync(settings.swatchkitDir);

  // --dry-run: always just report status, change nothing.
  // Already initialized without --force: auto dry-run.
  if (options.dryRun || (isInitialized && !options.force)) {
    if (isInitialized && !options.dryRun) {
      console.log("[SwatchKit] Project already initialized.");
    }
    reportInitStatus(settings);
    return;
  }

  // Sanity check: internal layout template must exist
  if (!fs.existsSync(settings.internalLayout)) {
    console.error(
      `Error: Internal layout file not found at ${settings.internalLayout}`,
    );
    process.exit(1);
  }

  console.log("[SwatchKit] Scaffolding project structure...");

  // Ensure directories exist
  const cwd = process.cwd();
  for (const dir of getInitDirs(settings)) {
    if (!fs.existsSync(dir)) {
      console.log(`+ Directory: ${path.relative(cwd, dir)}/`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Files that are auto-generated by SwatchKit — never back these up
  const swatchkitOwned = [path.join(settings.utilitiesDir, "utilities.css")];

  // Copy all manifest files
  const manifest = buildInitManifest(settings);
  for (const entry of manifest) {
    const exists = fs.existsSync(entry.dest);
    if (options.force || !exists) {
      // Ensure parent directory exists (for CSS subdirs like compositions/)
      const parentDir = path.dirname(entry.dest);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Back up existing user-owned files before overwriting with --force
      if (exists && options.force && !swatchkitOwned.includes(entry.dest)) {
        const backupPath = getBackupPath(entry.dest);
        fs.copyFileSync(entry.dest, backupPath);
        console.log(
          `  ~ Backed up: ${path.relative(cwd, entry.dest)} → ${path.basename(backupPath)}`,
        );
      }

      let content = fs.readFileSync(entry.src, "utf-8");
      if (entry.transform) content = entry.transform(content);
      fs.writeFileSync(entry.dest, content);

      const label = path.relative(cwd, entry.dest);
      console.log(`${exists ? "~ Updated" : "+ Created"}: ${label}`);
    }
  }

  // Generate utilities.css from the scaffolded tokens.css @swatchkit blocks.
  try {
    const blocks = parseTokenBlocks(settings.tokenSources, cwd);
    if (blocks.length > 0) {
      generateUtilities(blocks, settings.utilitiesDir);
      console.log(
        `+ Generated: ${path.relative(cwd, path.join(settings.utilitiesDir, "utilities.css"))} (do not edit manually)`,
      );
    }
  } catch (e) {
    console.warn(`[SwatchKit] Could not generate utilities: ${e.message}`);
  }

  // In --app mode, scaffoldApp prints the next-steps message instead.
  if (options.app) return;

  const tokensCssRel = path.relative(
    cwd,
    path.join(settings.cssDir, "global", "tokens.css"),
  );
  console.log(`
Done! Here's what to do next:

  1. Edit your design tokens in ${tokensCssRel}
       Tokens live in /* @swatchkit <type> "Label" */ ... /* @swatchkit end */
       blocks. Edit the values directly — it's plain, hand-editable CSS.

  2. Run "swatchkit" to build the pattern library

  3. Open dist/swatchkit/index.html to view it
`);
}

// --- 6.5 App Starter Scaffold (swatchkit init --app) ---
// Copies an integrated-app starter (esbuild build scripts, shared renderers,
// a home page, two example swatches) on top of the standard scaffold, and
// wires up package.json scripts/devDeps. Idempotent: skips existing files
// unless --force.
function scaffoldApp(settings, options) {
  const cwd = process.cwd();
  const appTemplates = path.join(__dirname, "src/templates/app");

  console.log("\n[SwatchKit] Scaffolding integrated app starter...");

  // 1. Copy plain template files to fixed destinations.
  const fileMap = [
    ["scripts/clean.js", "scripts/clean.js"],
    ["scripts/build-site.js", "scripts/build-site.js"],
    ["scripts/build-assets.js", "scripts/build-assets.js"],
    ["src/components/button.js", "src/components/button.js"],
    ["src/components/card.js", "src/components/card.js"],
    ["src/pages/home.js", "src/pages/home.js"],
    ["src/js/main.js", "src/js/main.js"],
    // Component CSS goes into the configured cssDir/swatches.
    ["css/button.css", path.join(settings.cssDir, "swatches", "button.css")],
    ["css/card.css", path.join(settings.cssDir, "swatches", "card.css")],
    // Example swatches.
    ["swatches/button/index.js", "swatchkit/swatches/button/index.js"],
    ["swatches/button/description.html", "swatchkit/swatches/button/description.html"],
    ["swatches/card/index.js", "swatchkit/swatches/card/index.js"],
    ["swatches/card/description.html", "swatchkit/swatches/card/description.html"],
  ];

  for (const [rel, destRel] of fileMap) {
    const src = path.join(appTemplates, rel);
    const dest = path.isAbsolute(destRel) ? destRel : path.join(cwd, destRel);
    const exists = fs.existsSync(dest);
    if (exists && !options.force) {
      console.log(`  = Skipped (exists): ${path.relative(cwd, dest)}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (exists && options.force) {
      const backupPath = getBackupPath(dest);
      fs.copyFileSync(dest, backupPath);
      console.log(`  ~ Backed up: ${path.relative(cwd, dest)} → ${path.basename(backupPath)}`);
    }
    fs.copyFileSync(src, dest);
    console.log(`  ${exists ? "~ Updated" : "+ Created"}: ${path.relative(cwd, dest)}`);
  }

  // 2. Register the component CSS in swatches/index.css (append if missing).
  const swatchIndex = path.join(settings.cssDir, "swatches", "index.css");
  if (fs.existsSync(swatchIndex)) {
    let css = fs.readFileSync(swatchIndex, "utf-8");
    let changed = false;
    for (const imp of ['@import "button.css";', '@import "card.css";']) {
      if (!css.includes(imp)) {
        css = css.trimEnd() + "\n" + imp + "\n";
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(swatchIndex, css);
      console.log(`  ~ Updated: ${path.relative(cwd, swatchIndex)} (registered button.css, card.css)`);
    }
  }

  // 3. Create or update package.json with scripts + devDeps.
  const pkgPath = path.join(cwd, "package.json");
  const pkgExisted = fs.existsSync(pkgPath);
  let pkg = {};
  if (pkgExisted) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } catch {
      console.warn("  ! Could not parse existing package.json — leaving it untouched.");
      pkg = null;
    }
  }

  if (pkg) {
    // Snapshot the on-disk content so we can tell whether we actually change
    // anything (avoids a misleading "Updated" on idempotent re-runs).
    const before = pkgExisted ? fs.readFileSync(pkgPath, "utf-8") : null;

    pkg.name = pkg.name || path.basename(cwd);
    pkg.version = pkg.version || "1.0.0";
    pkg.private = pkg.private !== undefined ? pkg.private : true;
    pkg.type = "module";

    const appScripts = {
      clean: "node scripts/clean.js",
      "build:site": "node scripts/build-site.js",
      "build:swatchkit": "swatchkit",
      "build:assets": "node scripts/build-assets.js",
      build:
        "npm run clean && npm run build:site && npm run build:swatchkit && npm run build:assets",
      "build:prod":
        "npm run clean && npm run build:site && npm run build:swatchkit && node scripts/build-assets.js --prod",
      "watch:site":
        "onchange 'src/pages/**/*' 'src/components/**/*' -- npm run build:site",
      "watch:assets":
        "onchange 'src/css/**/*' 'src/js/**/*' 'src/components/**/*' -e 'src/css/utilities/utilities.css' -- npm run build:assets",
      "swatchkit:watch": "swatchkit --watch",
      serve: "http-server dist -c-1 -p 8080 -o",
      dev: "npm run build && npm-run-all --parallel watch:site watch:assets swatchkit:watch serve",
    };
    pkg.scripts = pkg.scripts || {};
    for (const [k, v] of Object.entries(appScripts)) {
      // Don't clobber a user's existing script of the same name unless --force.
      if (pkg.scripts[k] === undefined || options.force) pkg.scripts[k] = v;
    }

    const appDevDeps = {
      esbuild: "^0.28.0",
      "http-server": "^14.1.1",
      "npm-run-all": "^4.1.5",
      onchange: "^7.1.0",
    };
    pkg.devDependencies = pkg.devDependencies || {};
    for (const [k, v] of Object.entries(appDevDeps)) {
      if (pkg.devDependencies[k] === undefined) pkg.devDependencies[k] = v;
    }
    // swatchkit itself is a dev dependency of the host app.
    if (pkg.devDependencies.swatchkit === undefined && pkg.dependencies?.swatchkit === undefined) {
      pkg.devDependencies.swatchkit = "^5.0.0";
    }

    const after = JSON.stringify(pkg, null, 2) + "\n";
    if (!pkgExisted) {
      fs.writeFileSync(pkgPath, after);
      console.log("  + Created: package.json (scripts + devDependencies)");
    } else if (after !== before) {
      fs.writeFileSync(pkgPath, after);
      console.log("  ~ Updated: package.json (scripts + devDependencies)");
    } else {
      console.log("  = package.json already up to date");
    }
  }

  console.log(`
Done! Integrated app starter scaffolded. Next:

  1. Install dependencies:
       npm install

  2. Start the dev loop (build, watch, serve):
       npm run dev

     The app is at http://localhost:8080/ and the pattern library at
     http://localhost:8080/swatchkit/. Edit src/components/button.js or
     src/components/card.js and both update.

  3. Production build (minified, no source maps):
       npm run build:prod
`);
}

// Entry point for the `init` command: ensure config, then scaffold.
async function runInit(cliOptions) {
  // The --app starter is ESM (config + build scripts use export/import). Make
  // package.json "type": "module" BEFORE writing/loading the ESM config, so the
  // config doesn't get loaded as CommonJS and fail with "Unexpected token
  // 'export'". (Plain `init` keeps matching the existing package.json#type.)
  if (cliOptions.app) {
    ensureEsmPackageJson();
  }

  await ensureConfig(cliOptions);

  // Re-load config + settings now that the config exists (it may have just
  // been created with a cssDir the user chose at the prompt).
  const fileConfig = await loadConfig(cliOptions.config);
  const settings = resolveSettings(cliOptions, fileConfig);

  scaffold(settings, cliOptions);

  if (cliOptions.app) {
    scaffoldApp(settings, cliOptions);
  }
}

// --- 6. Build Logic ---
function copyDir(src, dest, force = false) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, force);
    } else {
      if (force || !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        if (!force) console.log(`+ Copied: ${entry.name}`);
      }
    }
  }
}

// Special filenames that SwatchKit reads and treats differently — not copied verbatim.
const SWATCH_SPECIAL_FILES = new Set(["index.html", "index.js", "description.html"]);

// Recursively copy a swatch's assets (all files and subdirs except index.html,
// description.html, and anything prefixed with _ or .) to destDir.
function copySwatchAssets(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copySwatchAssets(src, dest);
    } else if (!SWATCH_SPECIAL_FILES.has(entry.name)) {
      fs.copyFileSync(src, dest);
    }
  }
}

async function scanSwatches(dir, destDir, exclude = []) {
  const swatches = [];
  if (!fs.existsSync(dir)) return swatches;

  const items = fs.readdirSync(dir);

  for (const item of items) {
    // Skip excluded items
    if (exclude.some((pattern) => matchesGlob(item, pattern))) continue;

    // Skip _swatchkit.html or hidden files
    if (item.startsWith("_") || item.startsWith(".")) continue;

    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    let slug, name, content, description;

    // Handle Component Directory
    if (stat.isDirectory()) {
      const indexJs = path.join(itemPath, "index.js");
      const indexHtml = path.join(itemPath, "index.html");

      // index.js takes priority over index.html
      if (fs.existsSync(indexJs)) {
        try {
          const url = pathToFileURL(indexJs).href + "?t=" + Date.now();
          const mod = await import(url);

          if (typeof mod.default !== "string") {
            throw new Error(`index.js must default-export an HTML string.`);
          }
          content = mod.default;
        } catch (e) {
          console.error(
            `[SwatchKit] Error loading ${indexJs}: ${e.message}`,
          );
          continue;
        }
      } else if (fs.existsSync(indexHtml)) {
        content = fs.readFileSync(indexHtml, "utf-8");
      } else {
        continue;
      }

      slug = item;
      name = toTitleCase(item);

      // Optional description shown above the iframe in the main UI
      const descriptionFile = path.join(itemPath, "description.html");
      if (fs.existsSync(descriptionFile)) {
        description = fs.readFileSync(descriptionFile, "utf-8");
      }

      // Copy all non-special files and subdirectories from the component
      // folder into its preview output directory so index.html can reference
      // them with relative paths (e.g. ./styles.css, ./script.js, ./img/).
      // Files and directories prefixed with _ or . are skipped.
      if (destDir) {
        const swatchDestDir = path.join(destDir, item);
        copySwatchAssets(itemPath, swatchDestDir);
      }
    }
    // Handle Single File
    else if (item.endsWith(".html")) {
      slug = path.basename(item, ".html");
      name = toTitleCase(slug);
      content = fs.readFileSync(itemPath, "utf-8");
    }

    if (slug && content) {
      swatches.push({ slug, name, content, description: description || null });
    }
  }

  return swatches;
}

function validateOutDir(outDir) {
  const cwd = process.cwd();
  const relative = path.relative(cwd, outDir);

  if (
    !relative || // outDir === cwd
    relative === ".." || // above cwd
    relative.startsWith("../") || // above cwd
    path.isAbsolute(relative) || // different drive/root
    relative.split(path.sep).length < 2 // top-level dir like "dist" with no subfolder
  ) {
    console.error(
      `[SwatchKit] Refusing to clean outDir "${outDir}" — must be a subdirectory at least 2 levels deep (e.g., dist/swatchkit).`,
    );
    process.exit(1);
  }
}

async function build(settings) {
  console.log(`[SwatchKit] Starting build...`);
  console.log(`  Source:   ${settings.swatchkitDir}`);
  console.log(`  Output:   ${settings.outDir}`);

  // 1. Check if source directory exists
  if (!fs.existsSync(settings.swatchkitDir)) {
    console.error(
      `Error: SwatchKit directory not found at ${settings.swatchkitDir}`,
    );
    console.error('Run "swatchkit init" to get started.');
    process.exit(1);
  }

  // 2. Clean previous output (only our subdirectory, never the parent)
  validateOutDir(settings.outDir);
  if (fs.existsSync(settings.outDir)) {
    fs.rmSync(settings.outDir, { recursive: true });
  }

  // 3. Ensure dist directories exist
  const distDirs = [settings.outDir];
  if (settings.cssCopy) distDirs.push(settings.distCssDir);
  distDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 2.5 Parse @swatchkit token blocks from CSS (the source of truth)
  console.log(
    `Parsing token blocks (${settings.tokenSources.join(", ")})...`,
  );
  const tokenBlocks = parseTokenBlocks(settings.tokenSources, process.cwd());
  const docTokenBlocks = filterTokenDocBlocks(
    mergeTokenBlocksByTypeAndLabel(tokenBlocks),
    settings.tokenDocs,
  );

  // Generate utilities.css into css/utilities/ from the parsed token blocks.
  if (tokenBlocks.length > 0) {
    const wrote = generateUtilities(tokenBlocks, settings.utilitiesDir);
    if (wrote) {
      console.log(
        `Generated utilities (${path.relative(process.cwd(), path.join(settings.utilitiesDir, "utilities.css"))})`,
      );
    }
  }

  // 2.6 Generate token documentation HTML (one rich display per block).
  // Always call this (even with zero blocks) so stale generated docs from
  // removed/renamed @swatchkit blocks get cleaned up — but only if the tokens
  // UI dir already exists, to avoid creating an empty dir in token-less setups.
  const tokensUiDir = path.join(settings.swatchkitDir, "tokens");
  if (docTokenBlocks.length > 0 || fs.existsSync(tokensUiDir)) {
    const { written, removed } = generateTokenDocs(
      docTokenBlocks,
      tokensUiDir,
      settings.tokenDocs,
    );
    if (written > 0) {
      console.log(
        `Generated ${written} token documentation files (swatchkit/tokens/*.html)`,
      );
    }
    if (removed > 0) {
      console.log(
        `Removed ${removed} stale generated token doc${removed === 1 ? "" : "s"} (swatchkit/tokens/*.html)`,
      );
    }
  }

  // 3. Copy CSS files (recursively) — skip if cssCopy is disabled
  if (settings.cssCopy && fs.existsSync(settings.cssDir)) {
    console.log("Copying static CSS assets (css/*)...");
    copyDir(settings.cssDir, settings.distCssDir, true);
  } else if (!settings.cssCopy) {
    console.log(
      `Skipping CSS copy (cssCopy: false). CSS referenced at: ${settings.cssPath}`,
    );
  }

  // 4. Read swatches
  console.log("Scanning HTML patterns (swatchkit/**/*.html)...");
  const sections = {}; // Map<SectionName, Array<Swatch>>

  if (fs.existsSync(settings.swatchkitDir)) {
    const items = fs.readdirSync(settings.swatchkitDir);
    const exclude = settings.exclude || [];

    // Scan subdirectories (Sections)
    for (const item of items) {
      if (exclude.some((p) => matchesGlob(item, p))) continue;
      if (item.startsWith(".") || item.startsWith("_")) continue;

      const itemPath = path.join(settings.swatchkitDir, item);
      if (fs.lstatSync(itemPath).isDirectory()) {
        // Check if section has any index.js or index.html (indicating it's not just a container)
        const hasIndexJs = fs.existsSync(path.join(itemPath, "index.js"));
        const hasIndexHtml = fs.existsSync(path.join(itemPath, "index.html"));

        // If it has neither index.js nor index.html, treat it as a section container
        if (!hasIndexJs && !hasIndexHtml) {
          const sectionName =
            item === "tokens" ? "Design Tokens" : toTitleCase(item);
          const sectionDestDir = path.join(settings.distPreviewDir, item);
          const swatches = await scanSwatches(itemPath, sectionDestDir, exclude);
          swatches.forEach((s) => {
            s.sectionSlug = item;
            if (item === "tokens" && s.content.includes("@swatchkit generated-token-doc")) {
              s.sourceKind = "generated-token";
              s.showSource = settings.tokenDocs.showSource === undefined
                ? false
                : settings.tokenDocs.showSource;
            }
          });
          if (swatches.length > 0) {
            const sectionOrder = settings.order.swatches && settings.order.swatches[item];
            sections[sectionName] = applyConfiguredOrder(
              swatches,
              sectionOrder,
              (swatch) => swatch.slug,
              (swatch) => swatch.name,
            );
          }
        }
      }
    }

    // Scan root swatches (Files + Component Folders at root)
    const rootSwatches = [];
    for (const item of items) {
      if (exclude.some((p) => matchesGlob(item, p))) continue;
      if (item.startsWith(".") || item.startsWith("_")) continue;

      const itemPath = path.join(settings.swatchkitDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith(".html")) {
        const slug = path.basename(item, ".html");
        const name = toTitleCase(slug);
        const content = fs.readFileSync(itemPath, "utf-8");
        rootSwatches.push({ slug, name, content, sectionSlug: null });
      } else if (stat.isDirectory()) {
        const indexJs = path.join(itemPath, "index.js");
        const indexHtml = path.join(itemPath, "index.html");

        if (fs.existsSync(indexJs)) {
          try {
            const url = pathToFileURL(indexJs).href + "?t=" + Date.now();
            const mod = await import(url);
            if (typeof mod.default !== "string") {
              throw new Error(`index.js must default-export an HTML string.`);
            }
            const descriptionFile = path.join(itemPath, "description.html");
            const description = fs.existsSync(descriptionFile)
              ? fs.readFileSync(descriptionFile, "utf-8")
              : null;
            const swatchDestDir = path.join(settings.distPreviewDir, item);
            copySwatchAssets(itemPath, swatchDestDir);
            rootSwatches.push({
              slug: item,
              name: toTitleCase(item),
              content: mod.default,
              description,
              sectionSlug: null,
            });
          } catch (e) {
            console.error(
              `[SwatchKit] Error loading ${indexJs}: ${e.message}`,
            );
            continue;
          }
        } else if (fs.existsSync(indexHtml)) {
          const descriptionFile = path.join(itemPath, "description.html");
          const description = fs.existsSync(descriptionFile)
            ? fs.readFileSync(descriptionFile, "utf-8")
            : null;
          const swatchDestDir = path.join(settings.distPreviewDir, item);
          copySwatchAssets(itemPath, swatchDestDir);
          rootSwatches.push({
            slug: item,
            name: toTitleCase(item),
            content: fs.readFileSync(indexHtml, "utf-8"),
            description,
            sectionSlug: null,
          });
        }
      }
    }

    if (rootSwatches.length > 0) {
      const sectionOrder = settings.order.swatches && settings.order.swatches.patterns;
      sections["Patterns"] = applyConfiguredOrder(
        rootSwatches,
        sectionOrder,
        (swatch) => swatch.slug,
        (swatch) => swatch.name,
      );
    }
  }

  // 5. Generate HTML fragments

  // Sidebar generation with grouping
  let sidebarLinks = "";
  let swatchBlocks = "";

  const sectionEntries = Object.keys(sections).map((category) => ({
    category,
    slug: categorySlug(category),
  }));
  const sortedSections = Array.isArray(settings.order.sections)
    ? applyConfiguredOrder(
        sectionEntries,
        settings.order.sections,
        (section) => section.slug,
        (section) => section.category,
      )
    : sectionEntries.sort((a, b) => defaultSectionSort(a.category, b.category));

  sortedSections.forEach(({ category, slug: categorySlug }) => {
    const swatches = sections[category];

    sidebarLinks +=
      settings.renderSidebarSection({
        category,
        categorySlug,
        items: swatches.map((p) => ({ slug: p.slug, name: p.name })),
      }) + "\n";

    swatchBlocks += swatches
      .map((p) => {
        const escapedContent = p.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

        const previewHref = p.sectionSlug
          ? `preview/${p.sectionSlug}/${p.slug}/`
          : `preview/${p.slug}/`;

        return settings.renderSwatchSection({
          slug: p.slug,
          name: p.name,
          category,
          categorySlug: p.sectionSlug,
          description: p.description,
          previewHref,
          content: p.content,
          escapedContent,
          sourceKind: p.sourceKind || null,
          showSource: p.showSource !== undefined ? p.showSource : true,
        });
      })
      .join("\n");
  });

  // 6. Generate preview pages (standalone full-screen view of each swatch)
  // Each swatch gets its own directory: preview/{section}/{id}/index.html
  // This allows index.html to reference sibling assets with relative paths.
  let previewLayoutContent;
  if (fs.existsSync(settings.projectPreviewLayout)) {
    previewLayoutContent = fs.readFileSync(
      settings.projectPreviewLayout,
      "utf-8",
    );
  } else if (fs.existsSync(settings.internalPreviewLayout)) {
    previewLayoutContent = fs.readFileSync(
      settings.internalPreviewLayout,
      "utf-8",
    );
  }

  if (previewLayoutContent) {
    let previewCount = 0;
    sortedSections.forEach(({ category }) => {
      const swatches = sections[category];
      swatches.forEach((p) => {
        // Each swatch is output as a directory with index.html inside.
        // preview/{category}/{slug}/index.html  — depth: 3 levels from outDir
        // preview/{slug}/index.html            — depth: 2 levels from outDir
        let swatchDir, cssPath;
        if (p.sectionSlug) {
          swatchDir = path.join(settings.distPreviewDir, p.sectionSlug, p.slug);
          cssPath = "../../../" + settings.cssPath; // preview/section/slug/index.html -> ../../../ + cssPath
        } else {
          swatchDir = path.join(settings.distPreviewDir, p.slug);
          cssPath = "../../" + settings.cssPath; // preview/slug/index.html -> ../../ + cssPath
        }

        if (!fs.existsSync(swatchDir))
          fs.mkdirSync(swatchDir, { recursive: true });
        const previewFile = path.join(swatchDir, "index.html");

        const previewHtml = previewLayoutContent
          .replace("<!-- PREVIEW_TITLE -->", p.name)
          .replace("<!-- PREVIEW_CONTENT -->", p.content)
          .replaceAll("<!-- CSS_PATH -->", cssPath)
          .replace("<!-- HEAD_EXTRAS -->", "");

        fs.writeFileSync(previewFile, previewHtml);
        previewCount++;
      });
    });
    console.log(
      `Generated ${previewCount} preview pages in ${settings.distPreviewDir}`,
    );
  }

  // 8. Load Layout
  let layoutContent;
  if (fs.existsSync(settings.projectLayout)) {
    console.log(`Using custom layout: ${settings.projectLayout}`);
    layoutContent = fs.readFileSync(settings.projectLayout, "utf-8");
  } else {
    // console.log(`Using internal layout`);
    layoutContent = fs.readFileSync(settings.internalLayout, "utf-8");
  }

  // HEAD_EXTRAS placeholder available for future use (e.g., custom fonts)
  const headExtras = "";

  const finalHtml = layoutContent
    .replace("<!-- SIDEBAR_LINKS -->", sidebarLinks)
    .replace("<!-- SWATCHES -->", swatchBlocks)
    .replaceAll("<!-- CSS_PATH -->", settings.cssPath)
    .replace("<!-- HEAD_EXTRAS -->", headExtras);

  // 9. Write output
  fs.writeFileSync(settings.outputFile, finalHtml);

  console.log(`Build complete! Generated ${settings.outputFile}`);
}

// --- 7. Watch Logic ---
function watch(settings) {
  // Resolve token source files to watch (so token edits trigger a rebuild).
  const { resolveTokenSources } = require("./src/token-parser");
  const tokenFiles = resolveTokenSources(settings.tokenSources, process.cwd());

  const sourcePaths = [
    settings.swatchkitDir,
    settings.projectLayout,
    settings.mainCssFile,
    ...tokenFiles,
  ].filter((p) => fs.existsSync(p)); // Only watch files that exist

  console.log("[SwatchKit] Watch mode enabled.");
  console.log("Watching for changes in:");
  sourcePaths.forEach((p) => console.log(`  - ${p}`));
  console.log(
    `  Polling: ${settings.outDir} (rebuild if deleted by external tools)`,
  );

  let buildTimeout;
  let building = false;
  let pending = false;

  const rebuild = () => {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(async () => {
      if (building) {
        pending = true;
        return;
      }
      building = true;
      try {
        console.log("[SwatchKit] Change detected. Rebuilding...");
        await build(settings);
      } catch (e) {
        console.error("[SwatchKit] Build failed:", e.message);
      } finally {
        building = false;
        if (pending) {
          pending = false;
          rebuild();
        }
      }
    }, 100);
  };

  // Watch source files for changes.
  // Ignore the tokens UI directory inside swatchkitDir — the build generates
  // HTML files there (swatchkit/tokens/*.html), which would retrigger the
  // watcher and cause an infinite rebuild loop.
  const tokensUiDir = path.join(settings.swatchkitDir, "tokens");
  const generatedUtilities = path.join(settings.utilitiesDir, "utilities.css");

  const sourceWatcher = chokidar.watch(sourcePaths, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      tokensUiDir, // ignore build-generated token HTML
      generatedUtilities, // ignore build-generated utilities.css
    ],
    persistent: true,
    ignoreInitial: true,
  });

  sourceWatcher.on("all", () => {
    rebuild();
  });

  // Poll for output directory deletion (e.g., when a framework build wipes dist/).
  // We use polling instead of a chokidar watcher on the output dir to avoid
  // infinite rebuild loops — since our own build deletes and recreates the
  // output directory, an event-based watcher would retrigger endlessly.
  setInterval(() => {
    if (!building && !fs.existsSync(settings.outDir)) {
      console.log("[SwatchKit] Output directory was deleted. Rebuilding...");
      rebuild();
    }
  }, 2000);
}

// --- 7. Help & Version ---
function printVersion() {
  const pkg = require(path.join(__dirname, "package.json"));
  console.log(pkg.version);
}

function printHelp() {
  const pkg = require(path.join(__dirname, "package.json"));
  console.log(`SwatchKit v${pkg.version}

Usage: swatchkit [command] [options]

Commands:
  init         Create swatchkit.config.js and scaffold the project
               (CSS blueprints, layout templates, starter tokens.css)
  init --app   Also scaffold an integrated app starter: esbuild build
               scripts, shared renderers, a home page, two example
               swatches, and watch-enabled package.json scripts
  (default)    Build the pattern library

Options:
      --app       With "init": scaffold the integrated esbuild app starter
  -w, --watch     Watch files and rebuild on change
  -c, --config    Path to config file
  -i, --input     Pattern directory (default: swatchkit/)
  -o, --outDir    Output directory (default: dist/swatchkit)
      --cssDir    CSS directory. Sets cssDir in swatchkit.config.js when
                  used with "init" (default: src/css). If no config file is
                  present at build time, the build falls back to ./css.
  -f, --force     Overwrite existing files (config + blueprints, with backups)
      --dry-run   Show what init would create or change, without writing
  -h, --help      Show this help message
  -v, --version   Show version number`);
}

// --- Main Execution ---
;(async () => {
  try {
    const cliOptions = parseArgs(process.argv);

    if (cliOptions.command === "help") {
      printHelp();
      process.exit(0);
    }
    if (cliOptions.command === "version") {
      printVersion();
      process.exit(0);
    }

    if (cliOptions.command === "init") {
      await runInit(cliOptions);
    } else {
      const fileConfig = await loadConfig(cliOptions.config);
      const settings = resolveSettings(cliOptions, fileConfig);
      build(settings).catch((error) => {
        console.error("[SwatchKit] Error:", error.message);
        process.exit(1);
      });
      if (cliOptions.watch) {
        watch(settings);
      }
    }
  } catch (error) {
    console.error("[SwatchKit] Error:", error.message);
    process.exit(1);
  }
})();
