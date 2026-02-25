#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { processTokens, generateTokenUtilities } = require("./src/tokens");
const { generateTokenSwatches } = require("./src/generators");

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
    force: false,
    dryRun: false,
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "init") {
      options.command = "init";
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
    }
  }
  return options;
}

// --- 2. Config Loading ---
function loadConfig(configPath) {
  let finalPath;
  if (configPath) {
    finalPath = path.resolve(process.cwd(), configPath);
  } else {
    finalPath = path.join(process.cwd(), "swatchkit.config.js");
  }

  if (fs.existsSync(finalPath)) {
    try {
      console.log(`[SwatchKit] Loading config from ${finalPath}`);
      return require(finalPath);
    } catch (e) {
      console.error("[SwatchKit] Error loading config file:", e.message);
      return {};
    }
  }
  return {};
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

  // Token definitions directory (JSON files the user edits)
  // Default: tokens/ at project root (separate from swatchkit/ UI)
  const tokensDir = fileConfig.tokensDir
    ? path.resolve(cwd, fileConfig.tokensDir)
    : path.join(cwd, "tokens");

  // Exclude patterns
  const exclude = fileConfig.exclude || [];

  // CSS copy behavior
  // When true (default), copies cssDir into outDir/css/ for a self-contained build.
  // When false, skips the copy — expects CSS to already exist at cssPath relative to output.
  const cssCopy = fileConfig.cssCopy !== undefined ? fileConfig.cssCopy : true;

  // Relative path from SwatchKit HTML output to the user's CSS directory.
  // Only used when cssCopy is false. Derived from cssDir basename by default
  // (e.g., cssDir: "./src/css" -> "../css/", cssDir: "./styles" -> "../styles/").
  const cssPath = fileConfig.cssPath || (cssCopy ? "css/" : `../${path.basename(cssDir)}/`);

  return {
    swatchkitDir,
    outDir,
    cssDir,
    tokensDir,
    exclude,
    cssCopy,
    cssPath,
    fileConfig, // Expose config to init
    // Internal layout templates (relative to this script)
    internalLayout: path.join(__dirname, "src/layout.html"),
    internalPreviewLayout: path.join(__dirname, "src/preview-layout.html"),
    // Project specific layout overrides
    projectLayout: path.join(swatchkitDir, "_layout.html"),
    projectPreviewLayout: path.join(swatchkitDir, "_preview.html"),

    // Derived paths
    distCssDir: path.join(outDir, "css"),
    distTokensCssFile: path.join(outDir, "css", "tokens.css"),
    distJsDir: path.join(outDir, "js"),
    distPreviewDir: path.join(outDir, "preview"),
    outputFile: path.join(outDir, "index.html"),
    outputJsFile: path.join(outDir, "js/swatches.js"),
    tokensCssFile: path.join(cssDir, "global", "tokens.css"),
    mainCssFile: path.join(cssDir, "main.css"),
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

  // Token blueprint JSON files
  const tokenFiles = [
    "colors.json",
    "text-weights.json",
    "text-leading.json",
    "viewports.json",
    "text-sizes.json",
    "spacing.json",
    "fonts.json",
  ];
  for (const file of tokenFiles) {
    manifest.push({
      src: path.join(blueprintsDir, file),
      dest: path.join(settings.tokensDir, file),
    });
  }

  // Template files (swatchkit/tokens/)
  const templateFiles = ["prose.html", "script.js"];
  for (const file of templateFiles) {
    manifest.push({
      src: path.join(templatesDir, file),
      dest: path.join(settings.swatchkitDir, "tokens", file),
      transform: (content) => content.trim(),
    });
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
    settings.tokensDir,
    path.join(settings.swatchkitDir, "tokens"),
    settings.cssDir,
    path.join(settings.cssDir, "global"),
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

// --- 5. Init Command Logic ---
function runInit(settings, options) {
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
  const swatchkitOwned = [
    path.join(settings.cssDir, "global", "tokens.css"),
    path.join(settings.cssDir, "utilities", "tokens.css"),
  ];

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
        console.log(`  ~ Backed up: ${path.relative(cwd, entry.dest)} → ${path.basename(backupPath)}`);
      }

      let content = fs.readFileSync(entry.src, "utf-8");
      if (entry.transform) content = entry.transform(content);
      fs.writeFileSync(entry.dest, content);

      const label = path.relative(cwd, entry.dest);
      console.log(`${exists ? "~ Updated" : "+ Created"}: ${label}`);
    }
  }

  // Generate tokens.css and utility tokens.css (always — these are generated files)
  const tokensContext = processTokens(
    settings.tokensDir,
    path.join(settings.cssDir, "global"),
  );
  if (tokensContext) {
    generateTokenUtilities(
      tokensContext,
      path.join(settings.cssDir, "utilities"),
    );
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

function scanSwatches(dir, scriptsCollector, exclude = []) {
  const swatches = [];
  if (!fs.existsSync(dir)) return swatches;

  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    // Skip excluded items
    if (exclude.some((pattern) => matchesGlob(item, pattern))) return;

    // Skip _layout.html or hidden files
    if (item.startsWith("_") || item.startsWith(".")) return;

    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    let name, content, id;

    // Handle Component Directory
    if (stat.isDirectory()) {
      const indexFile = path.join(itemPath, "index.html");

      if (fs.existsSync(indexFile)) {
        name = item;
        id = item;
        content = fs.readFileSync(indexFile, "utf-8");

        // Find all .js files
        const jsFiles = fs
          .readdirSync(itemPath)
          .filter((file) => file.endsWith(".js"));

        jsFiles.forEach((jsFile) => {
          const scriptContent = fs.readFileSync(
            path.join(itemPath, jsFile),
            "utf-8",
          );
          scriptsCollector.push(`
/* --- Swatch: ${name} / File: ${jsFile} --- */
(function() {
${scriptContent}
})();
`);
        });
      }
    }
    // Handle Single File
    else if (item.endsWith(".html")) {
      name = path.basename(item, ".html");
      id = name;
      content = fs.readFileSync(itemPath, "utf-8");
    }
    // Handle Loose JS Files (e.g. script.js in tokens/)
    else if (item.endsWith(".js")) {
      const scriptContent = fs.readFileSync(itemPath, "utf-8");
      scriptsCollector.push(`
/* --- File: ${item} --- */
(function() {
${scriptContent}
})();
`);
      // Don't add to swatches list, just scripts
      return;
    }

    if (name && content) {
      swatches.push({ name, id, content });
    }
  });

  return swatches;
}

function validateOutDir(outDir) {
  const cwd = process.cwd();
  const relative = path.relative(cwd, outDir);

  if (
    !relative ||                          // outDir === cwd
    relative === '..' ||                  // above cwd
    relative.startsWith('../') ||         // above cwd
    path.isAbsolute(relative) ||          // different drive/root
    relative.split(path.sep).length < 2   // top-level dir like "dist" with no subfolder
  ) {
    console.error(
      `[SwatchKit] Refusing to clean outDir "${outDir}" — must be a subdirectory at least 2 levels deep (e.g., dist/swatchkit).`,
    );
    process.exit(1);
  }
}

function build(settings) {
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
  const distDirs = [settings.outDir, settings.distJsDir];
  if (settings.cssCopy) distDirs.push(settings.distCssDir);
  distDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 2.5 Process Tokens
  console.log("Reading JSON tokens (tokens/*.json)...");
  // Output tokens.css to css/global/tokens.css
  const tokensContext = processTokens(settings.tokensDir, path.join(settings.cssDir, "global"));
  
  // Generate Utilities to css/utilities/tokens.css
  if (tokensContext) {
    generateTokenUtilities(tokensContext, path.join(settings.cssDir, "utilities"));
  }

  // 2.6 Generate token display HTML from JSON
  const tokensUiDir = path.join(settings.swatchkitDir, "tokens");
  if (fs.existsSync(tokensUiDir)) {
    const generated = generateTokenSwatches(settings.tokensDir, tokensUiDir);
    if (generated > 0) {
      console.log(`Generated ${generated} token documentation files (swatchkit/tokens/*.html)`);
    }
  }

  // 3. Copy CSS files (recursively) — skip if cssCopy is disabled
  if (settings.cssCopy && fs.existsSync(settings.cssDir)) {
    console.log("Copying static CSS assets (css/*)...");
    copyDir(settings.cssDir, settings.distCssDir, true);
  } else if (!settings.cssCopy) {
    console.log(`Skipping CSS copy (cssCopy: false). CSS referenced at: ${settings.cssPath}`);
  }

  // 4. Read swatches & JS
  console.log("Scanning HTML patterns (swatchkit/**/*.html)...");
  const scripts = [];
  const sections = {}; // Map<SectionName, Array<Swatch>>

  if (fs.existsSync(settings.swatchkitDir)) {
    const items = fs.readdirSync(settings.swatchkitDir);
    const exclude = settings.exclude || [];

    // Scan subdirectories (Sections)
    items.forEach((item) => {
      if (exclude.some((p) => matchesGlob(item, p))) return;
      if (item.startsWith(".") || item.startsWith("_")) return;

      const itemPath = path.join(settings.swatchkitDir, item);
      if (fs.lstatSync(itemPath).isDirectory()) {
        const hasIndex = fs.existsSync(path.join(itemPath, "index.html"));

        if (!hasIndex) {
          // It is a Section Container (e.g. "Utilities")
          const sectionName =
            item === "tokens" ? "Design Tokens" : toTitleCase(item);
          const swatches = scanSwatches(itemPath, scripts, exclude);
          // Tag each swatch with its section slug for preview paths
          swatches.forEach((s) => (s.sectionSlug = item));
          if (swatches.length > 0) {
            sections[sectionName] = swatches;
          }
        }
      }
    });

    // Scan root swatches (Files + Component Folders at root)
    const rootSwatches = [];
    items.forEach((item) => {
      if (exclude.some((p) => matchesGlob(item, p))) return;
      if (item.startsWith(".") || item.startsWith("_")) return;

      const itemPath = path.join(settings.swatchkitDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && item.endsWith(".html")) {
        const name = path.basename(item, ".html");
        const content = fs.readFileSync(itemPath, "utf-8");
        rootSwatches.push({ name, id: name, content, sectionSlug: null });
      } else if (stat.isDirectory()) {
        const indexFile = path.join(itemPath, "index.html");
        if (fs.existsSync(indexFile)) {
          // Component folder swatch at root
          const name = item;
          const content = fs.readFileSync(indexFile, "utf-8");
          rootSwatches.push({ name, id: name, content, sectionSlug: null });

          // Collect JS
          const jsFiles = fs
            .readdirSync(itemPath)
            .filter((f) => f.endsWith(".js"));
          jsFiles.forEach((jsFile) => {
            const scriptContent = fs.readFileSync(
              path.join(itemPath, jsFile),
              "utf-8",
            );
            scripts.push(
              `/* ${name}/${jsFile} */ (function(){${scriptContent}})();`,
            );
          });
        }
      }
    });

    if (rootSwatches.length > 0) {
      sections["Patterns"] = rootSwatches;
    }
  }

  // 5. Generate HTML fragments

  // Sidebar generation with grouping
  let sidebarLinks = "";
  let swatchBlocks = "";

  // Helper to sort sections: Tokens first, then A-Z, Patterns last
  const sortedKeys = Object.keys(sections).sort((a, b) => {
    if (a === "Design Tokens") return -1;
    if (b === "Design Tokens") return 1;
    if (a === "Patterns") return 1;
    if (b === "Patterns") return -1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach((section) => {
    const swatches = sections[section];
    sidebarLinks += `<h3>${section}</h3>\n`;
    sidebarLinks += `<ul role="list">\n`;
    sidebarLinks += swatches
      .map((p) => `  <li><a href="#${p.id}">${p.name}</a></li>`)
      .join("\n");
    sidebarLinks += `\n</ul>\n`;

    // Generate Blocks
    swatchBlocks += swatches
      .map((p) => {
        const escapedContent = p.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

        // Build preview path: preview/{section}/{name}.html or preview/{name}.html
        const previewPath = p.sectionSlug
          ? `preview/${p.sectionSlug}/${p.id}.html`
          : `preview/${p.id}.html`;
        const previewLink = previewPath.replace(/\.html$/, '');

        return `
      <section id="${p.id}" class="region flow">
        <h2>${p.name} <small style="font-weight: normal; opacity: 0.6; font-size: 0.7em">(${section})</small></h2>
        <iframe src="${previewPath}" style="width: 100%; border: var(--stroke); min-height: 25rem; resize: vertical; overflow: auto;"></iframe>
        <div class="swatchkit-preview-link"><a href="${previewLink}">View full screen</a></div>
        <details>
          <summary>View source</summary>
          <pre><code>${escapedContent}</code></pre>
        </details>
      </section>
    `;
      })
      .join("\n");
  });

  // 6. Write JS Bundle
  if (scripts.length > 0) {
    fs.writeFileSync(settings.outputJsFile, scripts.join("\n"));
    console.log(
      `Bundled ${scripts.length} scripts to ${settings.outputJsFile}`,
    );
  } else {
    fs.writeFileSync(settings.outputJsFile, "// No swatch scripts found");
  }

  // 7. Generate preview pages (standalone full-screen view of each swatch)
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
    sortedKeys.forEach((section) => {
      const swatches = sections[section];
      swatches.forEach((p) => {
        // Determine output path and relative CSS path.
        // Preview pages need to navigate up to the swatchkit output root,
        // then follow cssPath to reach the CSS files.
        let previewFile, cssPath;
        if (p.sectionSlug) {
          const sectionDir = path.join(settings.distPreviewDir, p.sectionSlug);
          if (!fs.existsSync(sectionDir))
            fs.mkdirSync(sectionDir, { recursive: true });
          previewFile = path.join(sectionDir, `${p.id}.html`);
          cssPath = "../../" + settings.cssPath; // preview/section/file.html -> ../../ + cssPath
        } else {
          if (!fs.existsSync(settings.distPreviewDir))
            fs.mkdirSync(settings.distPreviewDir, { recursive: true });
          previewFile = path.join(settings.distPreviewDir, `${p.id}.html`);
          cssPath = "../" + settings.cssPath; // preview/file.html -> ../ + cssPath
        }

        // JS always lives in the swatchkit output dir, so jsPath just
        // navigates back to the output root (not to the user's CSS dir).
        const jsPath = p.sectionSlug ? "../../" : "../";

        const previewHtml = previewLayoutContent
          .replace("<!-- PREVIEW_TITLE -->", p.name)
          .replace("<!-- PREVIEW_CONTENT -->", p.content)
          .replaceAll("<!-- CSS_PATH -->", cssPath)
          .replaceAll("<!-- JS_PATH -->", jsPath)
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
  const sourcePaths = [
    settings.swatchkitDir,
    settings.tokensDir,
    settings.projectLayout,
    settings.mainCssFile,
  ].filter((p) => fs.existsSync(p)); // Only watch files that exist

  console.log("[SwatchKit] Watch mode enabled.");
  console.log("Watching for changes in:");
  sourcePaths.forEach((p) => console.log(`  - ${p}`));
  console.log(`  Polling: ${settings.outDir} (rebuild if deleted by external tools)`);

  let buildTimeout;
  let isRebuilding = false;

  const rebuild = () => {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(() => {
      try {
        isRebuilding = true;
        console.log("[SwatchKit] Change detected. Rebuilding...");
        build(settings);
      } catch (e) {
        console.error("[SwatchKit] Build failed:", e.message);
      } finally {
        isRebuilding = false;
      }
    }, 100); // 100ms debounce
  };

  // Watch source files for changes.
  // Ignore the tokens UI directory inside swatchkitDir — the build generates
  // HTML files there (swatchkit/tokens/*.html), which would retrigger the
  // watcher and cause an infinite rebuild loop.
  const tokensUiDir = path.join(settings.swatchkitDir, "tokens");

  const sourceWatcher = chokidar.watch(sourcePaths, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      tokensUiDir,      // ignore build-generated token HTML
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
    if (!isRebuilding && !fs.existsSync(settings.outDir)) {
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
  (default)    Build the pattern library
  init         Scaffold layout, tokens, and CSS blueprints

Options:
  -w, --watch     Watch files and rebuild on change
  -c, --config    Path to config file
  -i, --input     Pattern directory (default: swatchkit/)
  -o, --outDir    Output directory (default: dist/swatchkit)
  -f, --force     Overwrite all blueprint files with latest SwatchKit versions.
                  Your existing files are backed up as .bak/.bak2 etc. before
                  overwriting. Only css/global/tokens.css and
                  css/utilities/tokens.css are excluded (auto-generated).
      --dry-run   Show what init would create or change, without writing
  -h, --help      Show this help message
  -v, --version   Show version number`);
}

// --- Main Execution ---
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

  const fileConfig = loadConfig(cliOptions.config);
  const settings = resolveSettings(cliOptions, fileConfig);

  if (cliOptions.command === "init") {
    runInit(settings, cliOptions);
  } else {
    build(settings);
    if (cliOptions.watch) {
      watch(settings);
    }
  }
} catch (error) {
  console.error("[SwatchKit] Error:", error.message);
  process.exit(1);
}
