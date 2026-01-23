#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
    force: false
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'init') {
      options.command = 'init';
    } else if (arg === '-w' || arg === '--watch') {
      options.watch = true;
    } else if (arg === '-f' || arg === '--force') {
      options.force = true;
    } else if (arg === '-c' || arg === '--config') {
      // Handle case where flag is last arg
      if (i + 1 < args.length) {
        options.config = args[++i];
      }
    } else if (arg === '-i' || arg === '--input') {
      if (i + 1 < args.length) {
        options.input = args[++i];
      }
    } else if (arg === '-o' || arg === '--outDir') {
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
    finalPath = path.join(process.cwd(), 'swatchkit.config.js');
  }

  if (fs.existsSync(finalPath)) {
    try {
      console.log(`[SwatchKit] Loading config from ${finalPath}`);
      return require(finalPath);
    } catch (e) {
      console.error('[SwatchKit] Error loading config file:', e.message);
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
    const candidates = ['swatches', 'src/swatches', 'src/patterns'];
    for (const cand of candidates) {
      const absPath = path.join(cwd, cand);
      if (fs.existsSync(absPath)) return absPath;
    }

    // 3. Fallback default (swatches)
    return path.join(cwd, 'swatches');
  }

  const patternsDir = findPatternsDir();

  // Output Dir
  // Default: public/swatchkit
  const outDir = cliOptions.outDir 
    ? path.resolve(cwd, cliOptions.outDir)
    : (fileConfig.outDir ? path.resolve(cwd, fileConfig.outDir) : path.join(cwd, 'public/swatchkit'));

  // CSS Dir (Legacy support: src/css)
  const cssDir = path.join(cwd, 'src/css');

  return {
    patternsDir,
    outDir,
    cssDir,
    // Internal layout template (relative to this script)
    internalLayout: path.join(__dirname, 'src/layout.html'),
    // Project specific layout override
    projectLayout: path.join(patternsDir, '_layout.html'),
    
    // Derived paths
    distCssDir: path.join(outDir, 'css'),
    distJsDir: path.join(outDir, 'js'),
    outputFile: path.join(outDir, 'index.html'),
    outputJsFile: path.join(outDir, 'js/patterns.js')
  };
}

// --- 4. Init Command Logic ---
function runInit(settings, options) {
  console.log('[SwatchKit] Initializing...');

  // Ensure patterns directory exists
  if (!fs.existsSync(settings.patternsDir)) {
    console.log(`Creating patterns directory: ${settings.patternsDir}`);
    fs.mkdirSync(settings.patternsDir, { recursive: true });
  }

  const targetLayout = settings.projectLayout;
  
  if (fs.existsSync(targetLayout) && !options.force) {
    console.warn(`Warning: Layout file already exists at ${targetLayout}`);
    console.warn('Use --force to overwrite.');
    return;
  }

  if (fs.existsSync(settings.internalLayout)) {
    const layoutContent = fs.readFileSync(settings.internalLayout, 'utf-8');
    fs.writeFileSync(targetLayout, layoutContent);
    console.log(`Created layout file at ${targetLayout}`);
  } else {
    console.error(`Error: Internal layout file not found at ${settings.internalLayout}`);
    process.exit(1);
  }
}

// --- 5. Build Logic ---
function build(settings) {
  console.log(`[SwatchKit] Starting build...`);
  console.log(`  Patterns: ${settings.patternsDir}`);
  console.log(`  Output:   ${settings.outDir}`);

  // 1. Check if patterns directory exists
  if (!fs.existsSync(settings.patternsDir)) {
    console.error(`Error: Patterns directory not found at ${settings.patternsDir}`);
    console.error('Run "swatchkit init" to get started.');
    process.exit(1);
  }

  // 2. Ensure dist directories exist
  [settings.outDir, settings.distCssDir, settings.distJsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 3. Copy CSS files
  if (fs.existsSync(settings.cssDir)) {
      console.log('Copying CSS...');
      const cssFiles = fs.readdirSync(settings.cssDir).filter(file => file.endsWith('.css'));
      cssFiles.forEach(file => {
          fs.copyFileSync(path.join(settings.cssDir, file), path.join(settings.distCssDir, file));
      });
  }

  // 4. Read patterns & JS
  console.log('Processing patterns...');
  const patterns = [];
  const scripts = [];

  const items = fs.readdirSync(settings.patternsDir);

  items.forEach(item => {
      // Skip _layout.html or hidden files
      if (item.startsWith('_') || item.startsWith('.')) return;

      const itemPath = path.join(settings.patternsDir, item);
      const stat = fs.statSync(itemPath);
      
      let name, content, id;

      // Handle Directory Pattern
      if (stat.isDirectory()) {
        const indexFile = path.join(itemPath, 'index.html');
        
        if (fs.existsSync(indexFile)) {
          name = item;
          id = item;
          content = fs.readFileSync(indexFile, 'utf-8');

          // Find all .js files
          const jsFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
          
          jsFiles.forEach(jsFile => {
             const scriptContent = fs.readFileSync(path.join(itemPath, jsFile), 'utf-8');
             scripts.push(`
/* --- Pattern: ${name} / File: ${jsFile} --- */
(function() {
${scriptContent}
})();
`);
          });
        }
      } 
      // Handle Single File Pattern
      else if (item.endsWith('.html')) {
        name = path.basename(item, '.html');
        id = name;
        content = fs.readFileSync(itemPath, 'utf-8');
      }

      if (name && content) {
        patterns.push({ name, id, content });
      }
    });

  // 5. Generate HTML fragments
  const sidebarLinks = patterns.map(p => 
    `<a href="#${p.id}">${p.name}</a>`
  ).join('\n');

  const patternBlocks = patterns.map(p => {
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
  }).join('\n');

  // 6. Write JS Bundle
  if (scripts.length > 0) {
    fs.writeFileSync(settings.outputJsFile, scripts.join('\n'));
    console.log(`Bundled ${scripts.length} scripts to ${settings.outputJsFile}`);
  } else {
    fs.writeFileSync(settings.outputJsFile, '// No pattern scripts found');
  }

  // 7. Load Layout
  let layoutContent;
  if (fs.existsSync(settings.projectLayout)) {
    console.log(`Using custom layout: ${settings.projectLayout}`);
    layoutContent = fs.readFileSync(settings.projectLayout, 'utf-8');
  } else {
    // console.log(`Using internal layout`);
    layoutContent = fs.readFileSync(settings.internalLayout, 'utf-8');
  }
  
  const finalHtml = layoutContent
    .replace('<!-- SIDEBAR_LINKS -->', sidebarLinks)
    .replace('<!-- PATTERNS -->', patternBlocks);

  // 8. Write output
  fs.writeFileSync(settings.outputFile, finalHtml);
  
  console.log(`Build complete! Generated ${settings.outputFile}`);
}

// --- Main Execution ---
try {
  const cliOptions = parseArgs(process.argv);
  const fileConfig = loadConfig(cliOptions.config);
  const settings = resolveSettings(cliOptions, fileConfig);

  if (cliOptions.command === 'init') {
    runInit(settings, cliOptions);
  } else {
    build(settings);
    if (cliOptions.watch) {
      console.log('[SwatchKit] Watch mode is not yet fully implemented.');
    }
  }
} catch (error) {
  console.error('[SwatchKit] Error:', error.message);
  process.exit(1);
}
