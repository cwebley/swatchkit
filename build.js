#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
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

// --- 3. Smart Defaults & Path Resolution ---
function resolveSettings(cliOptions, fileConfig) {
  const cwd = process.cwd();

  // Helper to find patterns dir
  function findPatternsDir() {
    // 1. Explicit input
    if (cliOptions.input) return path.resolve(cwd, cliOptions.input);
    if (fileConfig.input) return path.resolve(cwd, fileConfig.input);

    // 2. Search candidates
    const candidates = ["swatches", "src/swatches"];
    for (const cand of candidates) {
      const absPath = path.join(cwd, cand);
      if (fs.existsSync(absPath)) return absPath;
    }

    // 3. Fallback default (swatches)
    return path.join(cwd, "swatches");
  }

  const patternsDir = findPatternsDir();

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
    : path.join(patternsDir, "tokens");

  return {
    patternsDir,
    outDir,
    cssDir,
    tokensDir,
    fileConfig, // Expose config to init
    // Internal layout template (relative to this script)
    internalLayout: path.join(__dirname, "src/layout.html"),
    // Project specific layout override
    projectLayout: path.join(patternsDir, "_layout.html"),

    // Derived paths
    distCssDir: path.join(outDir, "css"),
    distTokensCssFile: path.join(outDir, "css", "tokens.css"),
    distJsDir: path.join(outDir, "js"),
    outputFile: path.join(outDir, "index.html"),
    outputJsFile: path.join(outDir, "js/patterns.js"),
    tokensCssFile: path.join(cssDir, "tokens.css"),
    stylesCssFile: path.join(cssDir, "styles.css"),
  };
}

// --- 4. Init Command Logic ---
function runInit(settings, options) {
  console.log("[SwatchKit] Initializing...");

  // Ensure patterns directory exists
  if (!fs.existsSync(settings.patternsDir)) {
    console.log(`Creating patterns directory: ${settings.patternsDir}`);
    fs.mkdirSync(settings.patternsDir, { recursive: true });
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
  const leadingFile = path.join(tokensDir, "text-leading.json");
  if (!fs.existsSync(leadingFile)) {
    const srcPath = path.join(__dirname, 'src/blueprints/text-leading.json');
    let sampleLeading = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));

    // Get settings from config or defaults
    const leadingConfig = settings.fileConfig?.tokens?.leading || {};
    if (leadingConfig.base) sampleLeading.base = leadingConfig.base;
    if (leadingConfig.ratio) sampleLeading.ratio = leadingConfig.ratio;
    if (leadingConfig.items) sampleLeading.items = leadingConfig.items;

    fs.writeFileSync(leadingFile, JSON.stringify(sampleLeading, null, 2));
    console.log(`Created sample tokens file at ${leadingFile}`);
  }

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
function scanDirectory(dir, scriptsCollector, exclude = []) {
  const patterns = [];
  if (!fs.existsSync(dir)) return patterns;

  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    // Skip excluded items, _layout.html, or hidden files
    if (exclude.includes(item)) return;
    if (item.startsWith("_") || item.startsWith(".")) return;

    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    let name, content, id;

    // Handle Directory Pattern
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
/* --- Pattern: ${name} / File: ${jsFile} --- */
(function() {
${scriptContent}
})();
`);
        });
      }
    }
    // Handle Single File Pattern
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
      // Don't add to patterns list, just scripts
      return;
    }

    if (name && content) {
      patterns.push({ name, id, content });
    }
  });

  return patterns;
}

function build(settings) {
  console.log(`[SwatchKit] Starting build...`);
  console.log(`  Patterns: ${settings.patternsDir}`);
  console.log(`  Output:   ${settings.outDir}`);

  // 1. Check if patterns directory exists
  if (!fs.existsSync(settings.patternsDir)) {
    console.error(
      `Error: Patterns directory not found at ${settings.patternsDir}`,
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

  // 3. Copy CSS files
  if (fs.existsSync(settings.cssDir)) {
    console.log("Copying CSS...");
    const cssFiles = fs
      .readdirSync(settings.cssDir)
      .filter((file) => file.endsWith(".css"));
    cssFiles.forEach((file) => {
      fs.copyFileSync(
        path.join(settings.cssDir, file),
        path.join(settings.distCssDir, file),
      );
    });
  }

  // 4. Read patterns & JS
  console.log("Processing patterns...");
  const scripts = [];

  // Pass 1: Tokens (in [patternsDir]/tokens/)
  const tokensDir = path.join(settings.patternsDir, "tokens");
  const tokenPages = scanDirectory(tokensDir, scripts);

  // Pass 2: Patterns (in [patternsDir], excluding 'tokens')
  const patternPages = scanDirectory(settings.patternsDir, scripts, ["tokens"]);

  // Combine for content generation (Tokens first, then Patterns)
  const allPatterns = [...tokenPages, ...patternPages];

  // 5. Generate HTML fragments

  // Sidebar generation with grouping
  let sidebarLinks = "";

  if (tokenPages.length > 0) {
    sidebarLinks += `<h3>Design Tokens</h3>\n`;
    sidebarLinks += tokenPages
      .map((p) => `<a href="#${p.id}">${p.name}</a>`)
      .join("\n");
    sidebarLinks += `\n`;
  }

  if (patternPages.length > 0) {
    sidebarLinks += `<h3>Patterns</h3>\n`;
    sidebarLinks += patternPages
      .map((p) => `<a href="#${p.id}">${p.name}</a>`)
      .join("\n");
  }

  const patternBlocks = allPatterns
    .map((p) => {
      const escapedContent = p.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      return `
      <section id="${p.id}">
        <h2>${p.name}</h2>
        <div class="preview">${p.content}</div>
        <pre><code>${escapedContent}</code></pre>
      </section>
    `;
    })
    .join("\n");

  // 6. Write JS Bundle
  if (scripts.length > 0) {
    fs.writeFileSync(settings.outputJsFile, scripts.join("\n"));
    console.log(
      `Bundled ${scripts.length} scripts to ${settings.outputJsFile}`,
    );
  } else {
    fs.writeFileSync(settings.outputJsFile, "// No pattern scripts found");
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
    .replace("<!-- PATTERNS -->", patternBlocks)
    .replace("<!-- HEAD_EXTRAS -->", headExtras);

  // 8. Write output
  fs.writeFileSync(settings.outputFile, finalHtml);

  console.log(`Build complete! Generated ${settings.outputFile}`);
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
      console.log("[SwatchKit] Watch mode is not yet fully implemented.");
    }
  }
} catch (error) {
  console.error("[SwatchKit] Error:", error.message);
  process.exit(1);
}
