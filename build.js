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
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "init") {
      options.command = "init";
    } else if (arg === "-w" || arg === "--watch") {
      options.watch = true;
    } else if (arg === "-f" || arg === "--force") {
      options.force = true;
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

  return {
    swatchkitDir,
    outDir,
    cssDir,
    tokensDir,
    exclude,
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

// --- 4. Init Command Logic ---
function runInit(settings, options) {
  console.log("[SwatchKit] Scaffolding project structure...");

  // Ensure swatchkit directory exists
  if (!fs.existsSync(settings.swatchkitDir)) {
    console.log(`+ Directory: ${settings.swatchkitDir}`);
    fs.mkdirSync(settings.swatchkitDir, { recursive: true });
  }

  // Create tokens/ directory at project root (JSON token definitions)
  const tokensDir = settings.tokensDir;
  if (!fs.existsSync(tokensDir)) {
    console.log(`+ Directory: ${tokensDir}`);
    fs.mkdirSync(tokensDir, { recursive: true });
  }

  // Create swatchkit/tokens/ directory (HTML/JS visual previews)
  const tokensUiDir = path.join(settings.swatchkitDir, "tokens");
  if (!fs.existsSync(tokensUiDir)) {
    console.log(`+ Directory: ${tokensUiDir}`);
    fs.mkdirSync(tokensUiDir, { recursive: true });
  }

  // Create css/ directory at project root
  if (!fs.existsSync(settings.cssDir)) {
    console.log(`+ Directory: ${settings.cssDir}`);
    fs.mkdirSync(settings.cssDir, { recursive: true });
  }

  // Create css/global directory
  const globalCssDir = path.join(settings.cssDir, "global");
  if (!fs.existsSync(globalCssDir)) {
    console.log(`+ Directory: ${globalCssDir}`);
    fs.mkdirSync(globalCssDir, { recursive: true });
  }

  // Copy JSON token blueprints to tokens/ (project root)
  const copyDefault = (srcFilename, destFilename) => {
    const destPath = path.join(tokensDir, destFilename);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(__dirname, "src/blueprints", srcFilename);
      const content = fs.readFileSync(srcPath, "utf-8");
      fs.writeFileSync(destPath, content);
      console.log(`+ Token Blueprint: ${destFilename}`);
    }
  };

  copyDefault("colors.json", "colors.json");
  copyDefault("text-weights.json", "text-weights.json");
  copyDefault("text-leading.json", "text-leading.json");
  copyDefault("viewports.json", "viewports.json");
  copyDefault("text-sizes.json", "text-sizes.json");
  copyDefault("spacing.json", "spacing.json");
  copyDefault("fonts.json", "fonts.json");

  // Copy HTML/JS template patterns to swatchkit/tokens/ (UI documentation)
  // Note: Token display templates (colors, typography, spacing, etc.) are
  // generated dynamically at build time from the JSON token files.
  const copyTemplate = (srcFilename, destFilename) => {
    const destPath = path.join(tokensUiDir, destFilename);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(__dirname, "src/templates", srcFilename);
      const content = fs.readFileSync(srcPath, "utf-8");
      fs.writeFileSync(destPath, content.trim());
      console.log(`+ Pattern Template: ${destFilename}`);
    }
  };

  // Only copy non-token templates (prose is a kitchen sink, not a token display)
  copyTemplate("prose.html", "prose.html");

  // Create shared script for tokens UI
  const tokensScriptFile = path.join(tokensUiDir, "script.js");
  if (!fs.existsSync(tokensScriptFile)) {
    const srcPath = path.join(__dirname, "src/templates/script.js");
    const content = fs.readFileSync(srcPath, "utf-8");
    fs.writeFileSync(tokensScriptFile, content.trim());
    console.log(`+ Script: ${path.basename(tokensScriptFile)}`);
  }

  // Create main.css entry point
  if (!fs.existsSync(settings.mainCssFile)) {
    const srcPath = path.join(__dirname, "src/blueprints/main.css");
    let content = fs.readFileSync(srcPath, "utf-8");

    // Default: Copy the files
    const copyCssBlueprint = (filename) => {
      const src = path.join(__dirname, "src/blueprints", filename);
      // Ensure destination path (cssDir) exists
      if (!fs.existsSync(settings.cssDir)) {
          fs.mkdirSync(settings.cssDir, { recursive: true });
      }
      const dest = path.join(settings.cssDir, filename);
      // Only copy if destination doesn't exist
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`+ CSS Blueprint: ${filename}`);
      }
    };
    
    // Global blueprints are now copied as a folder below

    fs.writeFileSync(settings.mainCssFile, content);
    console.log(`+ CSS Blueprint: main.css`);
  }

  // Copy Global Styles Folder
  const globalSrc = path.join(__dirname, "src/blueprints/global");
  const globalDest = path.join(settings.cssDir, "global");
  if (fs.existsSync(globalSrc)) {
    copyDir(globalSrc, globalDest);
  }

  // Copy Compositions
  const compositionsSrc = path.join(__dirname, "src/blueprints/compositions");
  const compositionsDest = path.join(settings.cssDir, "compositions");
  if (fs.existsSync(compositionsSrc)) {
    copyDir(compositionsSrc, compositionsDest);
  }

  // Copy Utilities
  const utilitiesSrc = path.join(__dirname, "src/blueprints/utilities");
  const utilitiesDest = path.join(settings.cssDir, "utilities");
  if (fs.existsSync(utilitiesSrc)) {
    copyDir(utilitiesSrc, utilitiesDest);
  }

  // Copy SwatchKit UI Styles
  const uiSrc = path.join(__dirname, "src/blueprints/swatchkit-ui.css");
  const uiDest = path.join(settings.cssDir, "swatchkit-ui.css");
  if (fs.existsSync(uiSrc) && !fs.existsSync(uiDest)) {
    fs.copyFileSync(uiSrc, uiDest);
    console.log(`+ CSS Blueprint: swatchkit-ui.css`);
  }

  // Generate initial tokens.css
  // processTokens now expects the folder where tokens.css should live
  // We pass settings.cssDir, but processTokens internally joins 'tokens.css'
  // So we need to point it to css/global
  const tokensContext = processTokens(settings.tokensDir, path.join(settings.cssDir, "global"));
  
  if (tokensContext) {
    generateTokenUtilities(tokensContext, path.join(settings.cssDir, "utilities"));
  }

  const targetLayout = settings.projectLayout;

  if (fs.existsSync(targetLayout) && !options.force) {
    console.warn(`! Layout already exists: ${targetLayout} (Use --force to overwrite)`);
  } else {
    if (fs.existsSync(settings.internalLayout)) {
      const layoutContent = fs.readFileSync(settings.internalLayout, "utf-8");
      fs.writeFileSync(targetLayout, layoutContent);
      console.log(`+ Layout: ${path.basename(targetLayout)}`);
    } else {
      console.error(
        `Error: Internal layout file not found at ${settings.internalLayout}`,
      );
      process.exit(1);
    }
  }

  // Copy preview layout template (standalone page for individual swatches)
  const targetPreview = settings.projectPreviewLayout;
  if (!fs.existsSync(targetPreview)) {
    if (fs.existsSync(settings.internalPreviewLayout)) {
      const previewContent = fs.readFileSync(
        settings.internalPreviewLayout,
        "utf-8",
      );
      fs.writeFileSync(targetPreview, previewContent);
      console.log(`+ Layout: ${path.basename(targetPreview)}`);
    }
  }
}

// --- 5. Build Logic ---
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
  [settings.outDir, settings.distCssDir, settings.distJsDir].forEach((dir) => {
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

  // 3. Copy CSS files (recursively)
  if (fs.existsSync(settings.cssDir)) {
    console.log("Copying static CSS assets (css/*)...");
    copyDir(settings.cssDir, settings.distCssDir, true);
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

        return `
      <section id="${p.id}" class="flow">
        <h2>${p.name} <small style="font-weight: normal; opacity: 0.6; font-size: 0.7em">(${section})</small></h2>
        <div class="preview">${p.content}</div>
        <div class="swatchkit-preview-link"><a href="${previewPath}">View full screen</a></div>
        <pre><code>${escapedContent}</code></pre>
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
        // Determine output path and relative CSS path
        let previewFile, cssPath;
        if (p.sectionSlug) {
          const sectionDir = path.join(settings.distPreviewDir, p.sectionSlug);
          if (!fs.existsSync(sectionDir))
            fs.mkdirSync(sectionDir, { recursive: true });
          previewFile = path.join(sectionDir, `${p.id}.html`);
          cssPath = "../../"; // preview/section/file.html -> ../../css/
        } else {
          if (!fs.existsSync(settings.distPreviewDir))
            fs.mkdirSync(settings.distPreviewDir, { recursive: true });
          previewFile = path.join(settings.distPreviewDir, `${p.id}.html`);
          cssPath = "../"; // preview/file.html -> ../css/
        }

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
    .replace("<!-- HEAD_EXTRAS -->", headExtras);

  // 9. Write output
  fs.writeFileSync(settings.outputFile, finalHtml);

  console.log(`Build complete! Generated ${settings.outputFile}`);
}

// --- 6. Watch Logic ---
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

// --- Main Execution ---
try {
  const cliOptions = parseArgs(process.argv);
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
