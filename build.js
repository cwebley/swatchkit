#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { processTokens } = require("./src/tokens");

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
  return str.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
  // Default: public/swatchkit
  const outDir = cliOptions.outDir
    ? path.resolve(cwd, cliOptions.outDir)
    : fileConfig.outDir
      ? path.resolve(cwd, fileConfig.outDir)
      : path.join(cwd, "public/swatchkit");

  // CSS directory - where tokens.css and user's styles.css live
  // Default: css/ at project root (not src/css/)
  const cssDir = fileConfig.css
    ? path.resolve(cwd, fileConfig.css)
    : path.join(cwd, "css");

  // Token definitions directory
  // Default: swatches/tokens/ (not src/tokens/)
  const tokensDir = fileConfig.tokens?.input
    ? path.resolve(cwd, fileConfig.tokens.input)
    : path.join(swatchkitDir, "tokens");
  
  // Exclude patterns
  const exclude = fileConfig.exclude || [];

  return {
    swatchkitDir,
    outDir,
    cssDir,
    tokensDir,
    exclude,
    fileConfig, // Expose config to init
    // Internal layout template (relative to this script)
    internalLayout: path.join(__dirname, "src/layout.html"),
    // Project specific layout override
    projectLayout: path.join(swatchkitDir, "_layout.html"),

    // Derived paths
    distCssDir: path.join(outDir, "css"),
    distTokensCssFile: path.join(outDir, "css", "tokens.css"),
    distJsDir: path.join(outDir, "js"),
    outputFile: path.join(outDir, "index.html"),
    outputJsFile: path.join(outDir, "js/swatches.js"),
    tokensCssFile: path.join(cssDir, "tokens.css"),
    stylesCssFile: path.join(cssDir, "styles.css"),
  };
}

// --- 4. Init Command Logic ---
function runInit(settings, options) {
  console.log("[SwatchKit] Initializing...");

  // Ensure swatchkit directory exists
  if (!fs.existsSync(settings.swatchkitDir)) {
    console.log(`Creating swatchkit directory: ${settings.swatchkitDir}`);
    fs.mkdirSync(settings.swatchkitDir, { recursive: true });
  }

  // Create swatches/tokens directory (for both JSON definitions and HTML patterns)
  const tokensDir = settings.tokensDir;
  if (!fs.existsSync(tokensDir)) {
    console.log(`Creating tokens directory: ${tokensDir}`);
    fs.mkdirSync(tokensDir, { recursive: true });
  }

  // Create css/ directory at project root
  if (!fs.existsSync(settings.cssDir)) {
    console.log(`Creating CSS directory: ${settings.cssDir}`);
    fs.mkdirSync(settings.cssDir, { recursive: true });
  }

  const copyDefault = (srcFilename, destFilename) => {
    const destPath = path.join(tokensDir, destFilename);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(__dirname, 'src/blueprints', srcFilename);
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(destPath, content);
      console.log(`Created token file at ${destPath}`);
    }
  };

  // 1. Create Colors Token
  copyDefault('colors.json', 'colors.json');

  // 2. Create Text Weights Token
  copyDefault('text-weights.json', 'text-weights.json');

  // 3. Create Text Leading Token
  copyDefault('text-leading.json', 'text-leading.json');

  // 4. Create Viewports Token
  copyDefault('viewports.json', 'viewports.json');

  // 5. Create Text Sizes Token (Fluid)
  copyDefault('text-sizes.json', 'text-sizes.json');

  // 6. Create Spacing Token
  copyDefault('spacing.json', 'spacing.json');

  // 7. Create Fonts Token
  copyDefault('fonts.json', 'fonts.json');

  const copyTemplate = (srcFilename, destFilename) => {
    const destPath = path.join(tokensDir, destFilename);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(__dirname, 'src/templates', srcFilename);
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.writeFileSync(destPath, content.trim());
      console.log(`Created pattern at ${destPath}`);
    }
  };

  // Create sample patterns
  copyTemplate('colors.html', 'colors.html');
  copyTemplate('text-weights.html', 'text-weights.html');
  copyTemplate('text-leading.html', 'text-leading.html');
  copyTemplate('typography.html', 'typography.html');
  copyTemplate('spacing.html', 'spacing.html');
  copyTemplate('fonts.html', 'fonts.html');

  // Create shared script for tokens
  const tokensScriptFile = path.join(tokensDir, "script.js");
  if (!fs.existsSync(tokensScriptFile)) {
    const srcPath = path.join(__dirname, 'src/templates/script.js');
    const content = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(tokensScriptFile, content.trim());
    console.log(`Created tokens script at ${tokensScriptFile}`);
  }

  // Create starter styles.css
  if (!fs.existsSync(settings.stylesCssFile)) {
    const srcPath = path.join(__dirname, 'src/blueprints/styles.css');
    const content = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(settings.stylesCssFile, content);
    console.log(`Created starter stylesheet at ${settings.stylesCssFile}`);
  }

  // Copy CSS Reset
  const resetSrc = path.join(__dirname, 'src/blueprints/reset.css');
  const resetDest = path.join(settings.cssDir, 'reset.css');
  if (fs.existsSync(resetSrc) && !fs.existsSync(resetDest)) {
    fs.copyFileSync(resetSrc, resetDest);
    console.log(`Created CSS reset at ${resetDest}`);
  }

  // Copy Compositions
  const compositionsSrc = path.join(__dirname, 'src/blueprints/compositions');
  const compositionsDest = path.join(settings.cssDir, 'compositions');
  if (fs.existsSync(compositionsSrc)) {
      copyDir(compositionsSrc, compositionsDest);
  }

  // Copy SwatchKit UI Styles
  const uiSrc = path.join(__dirname, 'src/blueprints/swatchkit-ui.css');
  const uiDest = path.join(settings.cssDir, 'swatchkit-ui.css');
  if (fs.existsSync(uiSrc) && !fs.existsSync(uiDest)) {
    fs.copyFileSync(uiSrc, uiDest);
    console.log(`Created UI styles at ${uiDest}`);
  }

  // Generate initial tokens.css
  processTokens(settings.tokensDir, settings.cssDir);

  const targetLayout = settings.projectLayout;

  if (fs.existsSync(targetLayout) && !options.force) {
    console.warn(`Warning: Layout file already exists at ${targetLayout}`);
    console.warn("Use --force to overwrite.");
    return;
  }

  if (fs.existsSync(settings.internalLayout)) {
    const layoutContent = fs.readFileSync(settings.internalLayout, "utf-8");
    fs.writeFileSync(targetLayout, layoutContent);
    console.log(`Created layout file at ${targetLayout}`);
  } else {
    console.error(
      `Error: Internal layout file not found at ${settings.internalLayout}`,
    );
    process.exit(1);
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
        if (!force) console.log(`Created file at ${destPath}`);
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
    if (exclude.some(pattern => matchesGlob(item, pattern))) return;

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

  // 2. Ensure dist directories exist
  [settings.outDir, settings.distCssDir, settings.distJsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 2.5 Process Tokens
  processTokens(settings.tokensDir, settings.cssDir);

  // 3. Copy CSS files (recursively)
  if (fs.existsSync(settings.cssDir)) {
    console.log("Copying CSS...");
    copyDir(settings.cssDir, settings.distCssDir, true);
  }

  // 4. Read swatches & JS
  console.log("Processing swatches...");
  const scripts = [];
  const sections = {}; // Map<SectionName, Array<Swatch>>

  if (fs.existsSync(settings.swatchkitDir)) {
    const items = fs.readdirSync(settings.swatchkitDir);
    const exclude = settings.exclude || [];

    // Scan subdirectories (Sections)
    items.forEach(item => {
      if (exclude.some(p => matchesGlob(item, p))) return;
      if (item.startsWith(".") || item.startsWith("_")) return;

      const itemPath = path.join(settings.swatchkitDir, item);
      if (fs.lstatSync(itemPath).isDirectory()) {
        const hasIndex = fs.existsSync(path.join(itemPath, "index.html"));
        
        if (!hasIndex) {
           // It is a Section Container (e.g. "Utilities")
           const sectionName = item === 'tokens' ? 'Design Tokens' : toTitleCase(item);
           const swatches = scanSwatches(itemPath, scripts, exclude);
           if (swatches.length > 0) {
             sections[sectionName] = swatches;
           }
        }
      }
    });

    // Scan root swatches (Files + Component Folders at root)
    const rootSwatches = [];
    items.forEach(item => {
        if (exclude.some(p => matchesGlob(item, p))) return;
        if (item.startsWith(".") || item.startsWith("_")) return;
        
        const itemPath = path.join(settings.swatchkitDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile() && item.endsWith('.html')) {
             const name = path.basename(item, ".html");
             const content = fs.readFileSync(itemPath, "utf-8");
             rootSwatches.push({ name, id: name, content });
        } else if (stat.isDirectory()) {
            const indexFile = path.join(itemPath, "index.html");
            if (fs.existsSync(indexFile)) {
                // Component folder swatch at root
                const name = item;
                const content = fs.readFileSync(indexFile, "utf-8");
                rootSwatches.push({ name, id: name, content });
                
                // Collect JS
                const jsFiles = fs.readdirSync(itemPath).filter(f => f.endsWith(".js"));
                jsFiles.forEach(jsFile => {
                    const scriptContent = fs.readFileSync(path.join(itemPath, jsFile), "utf-8");
                    scripts.push(`/* ${name}/${jsFile} */ (function(){${scriptContent}})();`);
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
    if (a === 'Design Tokens') return -1;
    if (b === 'Design Tokens') return 1;
    if (a === 'Patterns') return 1;
    if (b === 'Patterns') return -1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach(section => {
    const swatches = sections[section];
    sidebarLinks += `<h3>${section}</h3>\n`;
    sidebarLinks += swatches
      .map((p) => `<a href="#${p.id}">${p.name}</a>`)
      .join("\n");
    sidebarLinks += `\n`;

    // Generate Blocks
    swatchBlocks += swatches.map((p) => {
      const escapedContent = p.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      return `
      <section id="${p.id}">
        <h2>${p.name} <small style="font-weight: normal; opacity: 0.6; font-size: 0.7em">(${section})</small></h2>
        <div class="preview">${p.content}</div>
        <pre><code>${escapedContent}</code></pre>
      </section>
    `;
    }).join("\n");
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

  // 7. Load Layout
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

  // 8. Write output
  fs.writeFileSync(settings.outputFile, finalHtml);

  console.log(`Build complete! Generated ${settings.outputFile}`);
}

// --- 6. Watch Logic ---
function watch(settings) {
  const watchPaths = [
    settings.swatchkitDir,
    settings.tokensDir,
    settings.projectLayout,
    settings.stylesCssFile
  ].filter(p => fs.existsSync(p)); // Only watch files that exist

  console.log("[SwatchKit] Watch mode enabled.");
  console.log("Watching for changes in:");
  watchPaths.forEach(p => console.log(`  - ${p}`));

  let buildTimeout;
  const rebuild = () => {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(() => {
      try {
        console.log("[SwatchKit] Change detected. Rebuilding...");
        build(settings);
      } catch (e) {
        console.error("[SwatchKit] Build failed:", e.message);
      }
    }, 100); // 100ms debounce
  };

  const watcher = chokidar.watch(watchPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('all', (event, path) => {
    rebuild();
  });
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
