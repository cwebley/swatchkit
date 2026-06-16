/**
 * SwatchKit Token Generators (v5)
 *
 * v5 is CSS-first: tokens are parsed from the user's CSS (see token-parser.js)
 * into "blocks" of the shape:
 *
 *   { type, label, parentSelector, atRuleChain, sourceFile, sourceLine,
 *     tokens: [{ name: "--foo", value: "<verbatim authored value>" }] }
 *
 * This module turns those blocks into:
 *   1. Documentation HTML (one rich, type-specific display per block).
 *   2. A generated utilities.css (utility classes referencing var(--name),
 *      deduped across all blocks).
 *
 * Chips/swatches are rendered from the VERBATIM authored value via inline
 * `style="background: <value>"`, so a "Dark Colors" table shows dark colors
 * even on a light page — independent of the cascade. The browser resolves
 * var()/oklch(from ...)/clamp() at render time.
 */

const fs = require("fs");
const path = require("path");

// Marker written at the top of every generated token-doc HTML file. Used to
// safely identify and remove stale generated docs (e.g. when an @swatchkit
// block is removed or renamed) WITHOUT touching hand-authored files a user may
// have placed in swatchkit/tokens/.
const GENERATED_TOKEN_DOC_MARKER = "<!-- @swatchkit generated-token-doc -->";

// --- HTML / CSS escaping helpers ---------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Strip the leading -- from a custom property to make the utility/display name.
function tokenBaseName(prop) {
  return prop.replace(/^--/, "");
}

// Escape a token name for use inside a CSS selector (the ":" in utility class
// names must be escaped: .color\:foo).
function escapeForSelector(name) {
  return name.replace(/:/g, "\\:");
}

// --- Browser-side computed-value annotation ----------------------------------
// Annotates .token-value elements with their resolved computed value. Included
// inline so each generated fragment is self-contained.
const TOKEN_DISPLAY_SCRIPT = `<script>
(function() {
  var elements = document.querySelectorAll('.token-value');
  if (!elements.length) return;
  elements.forEach(function(el) {
    var prop = el.getAttribute('data-var');
    var computed = getComputedStyle(el).getPropertyValue(prop).trim();
    if (computed) {
      el.innerHTML += ' <span style="opacity:0.5;font-family:monospace;font-size:0.8em">(' + computed + ')</span>';
    } else {
      var temp = document.createElement('div');
      temp.style.fontSize = '16px';
      temp.style.lineHeight = 'var(' + prop + ')';
      document.body.appendChild(temp);
      var computedPx = getComputedStyle(temp).lineHeight;
      document.body.removeChild(temp);
      var displayValue = computedPx;
      if (computedPx.endsWith('px')) {
        var ratio = Math.round((parseFloat(computedPx) / 16) * 100) / 100;
        displayValue = String(ratio);
      }
      if (displayValue) {
        el.innerHTML += ' <span style="opacity:0.5;font-family:monospace;font-size:0.8em">(' + displayValue + ')</span>';
      }
    }
  });
})();
</script>`;

// =============================================================================
// Documentation renderers (one per token type)
// Each takes a block and returns an HTML string.
// =============================================================================

const DEFAULT_COLOR_COLUMNS = [
  "name",
  "value",
  "customProperty",
  "colorUtility",
  "backgroundUtility",
];

const COLOR_COLUMNS = {
  name: {
    label: "Name",
    cell: (t, base) => `<td>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap;">
            <div style="background: ${escapeHtml(t.value)}; width: 2rem; height: 2rem; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0;" role="presentation"></div>
            <strong>${escapeHtml(base)}</strong>
          </div>
        </td>`,
  },
  value: {
    label: "Value",
    cell: (t) => `<td><code>${escapeHtml(t.value)}</code></td>`,
  },
  customProperty: {
    label: "Custom Property",
    cell: (t) => `<td><code>var(${escapeHtml(t.name)})</code></td>`,
  },
  colorUtility: {
    label: "Color Utility Class",
    cell: (_t, base) => `<td><code>.color:${escapeHtml(base)}</code></td>`,
  },
  backgroundUtility: {
    label: "BG Utility Class",
    cell: (_t, base) => `<td><code>.background-color:${escapeHtml(base)}</code></td>`,
  },
};

function colorColumns(options = {}) {
  if (!Array.isArray(options.columns)) return DEFAULT_COLOR_COLUMNS;

  const columns = options.columns.filter((key) => COLOR_COLUMNS[key]);
  return columns.length > 0 ? columns : DEFAULT_COLOR_COLUMNS;
}

function renderColors(block, options = {}) {
  const columns = colorColumns(options);
  const labels = options.columnLabels || {};
  const headers = columns
    .map((key) => `      <th>${escapeHtml(labels[key] || COLOR_COLUMNS[key].label)}</th>`)
    .join("\n");

  const rows = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      const cells = columns
        .map((key) => COLOR_COLUMNS[key].cell(t, base))
        .join("\n        ");
      return `      <tr>
${cells}
      </tr>`;
    })
    .join("\n");

  return `<table class="color-table">
  <thead>
    <tr>
${headers}
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>

<style>
  .color-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .color-table th,
  .color-table td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #ddd;
    vertical-align: middle;
  }
  .color-table th {
    font-weight: bold;
    background: #f5f5f5;
  }
  .color-table code {
    font-family: monospace;
  }
</style>`;
}

function renderTextSizes(block) {
  const steps = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `  <div class="type-step">
    <div class="type-sample" style="font-size: var(${escapeHtml(t.name)})">${escapeHtml(base)}</div>
    <div class="type-meta">
      <code>var(${escapeHtml(t.name)})</code>
      <code>.font-size:${escapeHtml(base)}</code>
      <code>${escapeHtml(t.value)}</code>
      <span class="token-value" data-var="${escapeHtml(t.name)}"></span>
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="type-ladder">
${steps}
</div>

<style>
  .type-ladder {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .type-step {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 1.5rem;
  }
  .type-sample {
    line-height: 1.2;
  }
  .type-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font-size: 0.8rem;
    font-family: monospace;
    color: #666;
  }
</style>
${TOKEN_DISPLAY_SCRIPT}`;
}

function renderSpacing(block) {
  const scaleRows = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `      <tr>
        <td>
          <div class="spacing-swatch" style="height: var(${escapeHtml(t.name)});"></div>
        </td>
        <td><strong>${escapeHtml(base)}</strong></td>
        <td><code>var(${escapeHtml(t.name)})</code></td>
        <td><code>${escapeHtml(t.value)}</code></td>
      </tr>`;
    })
    .join("\n");

  const usageRows = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `      <tr>
        <td><code>var(${escapeHtml(t.name)})</code></td>
        <td><code>.padding-block:${escapeHtml(base)}</code></td>
        <td><code>.padding-inline:${escapeHtml(base)}</code></td>
        <td><code>.margin-block:${escapeHtml(base)}</code></td>
        <td><code>.flow-space:${escapeHtml(base)}</code></td>
        <td><code>.gutter:${escapeHtml(base)}</code></td>
        <td><code>.region-space:${escapeHtml(base)}</code></td>
      </tr>`;
    })
    .join("\n");

  return `<h2 style="font-family: monospace; margin-bottom: 0.5rem;">Scale</h2>
<table class="spacing-table">
  <thead>
    <tr>
      <th width="120px"></th>
      <th>Name</th>
      <th>Custom Property</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
${scaleRows}
  </tbody>
</table>

<h2 style="font-family: monospace; margin-bottom: 0.5rem;">Usage</h2>
<table class="spacing-table">
  <thead>
    <tr>
      <th>Custom Property</th>
      <th>Padding Block</th>
      <th>Padding Inline</th>
      <th>Margin Block</th>
      <th>Flow Space</th>
      <th>Gutter</th>
      <th>Region Space</th>
    </tr>
  </thead>
  <tbody>
${usageRows}
  </tbody>
</table>

<style>
  .spacing-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    margin-bottom: 2rem;
  }
  .spacing-table th,
  .spacing-table td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #ddd;
    vertical-align: middle;
  }
  .spacing-table th {
    font-weight: bold;
    background: #f5f5f5;
  }
  .spacing-table code {
    font-family: monospace;
  }
  .spacing-swatch {
    background: var(--color-primary, #666);
    min-height: 4px;
    width: 100%;
    min-width: 4px;
    border-radius: 2px;
  }
</style>`;
}

function renderFonts(block) {
  const stacks = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `  <div style="font-family: var(${escapeHtml(t.name)}); margin-bottom: 2rem;">
    <strong>${escapeHtml(base)}</strong> <code class="token-value" data-var="${escapeHtml(t.name)}">var(${escapeHtml(t.name)})</code>
    <p>The quick brown fox jumps over the lazy dog.</p>
  </div>`;
    })
    .join("\n");

  return `<div class="font-stack">
${stacks}
</div>
${TOKEN_DISPLAY_SCRIPT}`;
}

function renderTextWeights(block) {
  const weights = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `  <div class="weight-step">
    <div class="weight-sample" style="font-weight: var(${escapeHtml(t.name)})">The quick brown fox jumps over the lazy dog.</div>
    <div class="weight-meta">
      <code>var(${escapeHtml(t.name)})</code>
      <code>.font-weight:${escapeHtml(base)}</code>
      <span>${escapeHtml(t.value)}</span>
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="weight-ladder">
${weights}
</div>

<style>
  .weight-ladder {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .weight-step {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 1.5rem;
  }
  .weight-sample {
    font-size: 1.25rem;
  }
  .weight-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font-size: 0.8rem;
    font-family: monospace;
    color: #666;
  }
</style>`;
}

function renderTextLeading(block) {
  const loremText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;

  const leadings = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      return `  <div style="line-height: var(${escapeHtml(t.name)})">
    <div class="meta">
      <code>var(${escapeHtml(t.name)})</code>
      <code>.line-height:${escapeHtml(base)}</code>
      <span class="token-value" data-var="${escapeHtml(t.name)}"></span>
    </div>
    <p>${loremText}</p>
  </div>`;
    })
    .join("\n\n");

  return `<div class="flow">
${leadings}
</div>

<style>
  .meta {
    font-family: monospace;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    background: #eee;
    padding: 0.25rem 0.5rem;
    display: inline-block;
    border-radius: 4px;
  }
  .token-value {
    color: #666;
    margin-left: 0.5rem;
  }
</style>
${TOKEN_DISPLAY_SCRIPT}`;
}

function renderViewports(block) {
  const items = block.tokens
    .map((t) => {
      const base = tokenBaseName(t.name);
      // Use the authored value directly as the bar width when it's a length.
      const barWidth = /^\d/.test(t.value) ? t.value : "100%";
      return `  <div class="viewport-item">
    <div class="viewport-bar" style="width: ${escapeHtml(barWidth)}">
      <span class="viewport-meta">
        <strong>${escapeHtml(base)}</strong>
        <code>var(${escapeHtml(t.name)})</code>
        <span class="viewport-value">${escapeHtml(t.value)}</span>
      </span>
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="viewport-list">
${items}
</div>

<style>
  .viewport-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: monospace;
  }
  .viewport-item {
    display: flex;
  }
  .viewport-bar {
    background: var(--color-primary, #666);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    min-width: max-content;
    flex-shrink: 0;
  }
  .viewport-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.9rem;
    color: var(--color-light, #fff);
    white-space: nowrap;
  }
  .viewport-meta code {
    opacity: 0.75;
  }
  .viewport-value {
    font-weight: bold;
    margin-left: auto;
    padding-left: 2rem;
  }
</style>`;
}

// type -> { doc: renderer, utilities: emitter | null, defaultTitle }
const TYPE_REGISTRY = {
  colors: { doc: renderColors, utilities: emitColorUtilities, defaultTitle: "Colors" },
  spacing: { doc: renderSpacing, utilities: emitSpacingUtilities, defaultTitle: "Spacing" },
  "text-sizes": { doc: renderTextSizes, utilities: emitFontSizeUtilities, defaultTitle: "Text Sizes" },
  "text-weights": { doc: renderTextWeights, utilities: emitFontWeightUtilities, defaultTitle: "Text Weights" },
  "text-leading": { doc: renderTextLeading, utilities: emitLineHeightUtilities, defaultTitle: "Text Leading" },
  fonts: { doc: renderFonts, utilities: emitFontFamilyUtilities, defaultTitle: "Fonts" },
  viewports: { doc: renderViewports, utilities: null, defaultTitle: "Viewports" },
};

// =============================================================================
// Utility emitters (one per type). Each returns an array of CSS rule strings.
// Rules reference var(--name) so they theme correctly at runtime and dedup
// across variant blocks.
//
// No !important: utilities.css is imported into the `utilities` cascade layer,
// which main.css declares LAST. Later layers win over earlier ones regardless
// of specificity, so a utility class beats component/app styles without the
// !important hammer. (Unlayered CSS still overrides every layer — the escape
// hatch.)
// =============================================================================

function emitColorUtilities(token) {
  const base = tokenBaseName(token.name);
  const sel = escapeForSelector(base);
  return [
    `.color\\:${sel} { color: var(${token.name}); }`,
    `.background-color\\:${sel} { background-color: var(${token.name}); }`,
  ];
}

function emitFontSizeUtilities(token) {
  const base = escapeForSelector(tokenBaseName(token.name));
  return [`.font-size\\:${base} { font-size: var(${token.name}); }`];
}

function emitFontWeightUtilities(token) {
  const base = escapeForSelector(tokenBaseName(token.name));
  return [`.font-weight\\:${base} { font-weight: var(${token.name}); }`];
}

function emitLineHeightUtilities(token) {
  const base = escapeForSelector(tokenBaseName(token.name));
  return [`.line-height\\:${base} { line-height: var(${token.name}); }`];
}

function emitFontFamilyUtilities(token) {
  const base = escapeForSelector(tokenBaseName(token.name));
  return [`.font-family\\:${base} { font-family: var(${token.name}); }`];
}

const SPACING_PROPERTIES = [
  "margin-block",
  "margin-block-start",
  "margin-block-end",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "padding-block",
  "padding-block-start",
  "padding-block-end",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
];

function emitSpacingUtilities(token) {
  const base = escapeForSelector(tokenBaseName(token.name));
  const rules = SPACING_PROPERTIES.map(
    (prop) => `.${prop}\\:${base} { ${prop}: var(${token.name}); }`,
  );
  rules.push(`.gap\\:${base} { gap: var(${token.name}); }`);
  rules.push(`.region-space\\:${base} { --region-space: var(${token.name}); }`);
  rules.push(`.flow-space\\:${base} { --flow-space: var(${token.name}); }`);
  rules.push(`.gutter\\:${base} { --gutter: var(${token.name}); }`);
  return rules;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate the utilities CSS string from parsed token blocks.
 * Emits rules for every token in every block, then dedups identical rule
 * strings (variant blocks of the same token produce identical rules).
 */
function generateUtilitiesCss(blocks) {
  const seen = new Set();
  const ordered = [];

  for (const block of blocks) {
    const emitter = TYPE_REGISTRY[block.type] && TYPE_REGISTRY[block.type].utilities;
    if (!emitter) continue; // e.g. viewports
    for (const token of block.tokens) {
      for (const rule of emitter(token)) {
        if (!seen.has(rule)) {
          seen.add(rule);
          ordered.push(rule);
        }
      }
    }
  }

  let css = "/* AUTO-GENERATED by SwatchKit — do not edit manually. */\n";
  css += "/* Utility classes derived from your @swatchkit token blocks. */\n";
  css += "/* Imported into the `utilities` cascade layer by main.css (declared\n";
  css += "   last), so these win without !important. */\n\n";
  css += ordered.join("\n") + "\n";
  return css;
}

/**
 * Write utilities.css into the given directory if changed. Returns true if
 * written.
 */
function generateUtilities(blocks, utilitiesDir) {
  const outputFile = path.join(utilitiesDir, "utilities.css");
  const css = generateUtilitiesCss(blocks);
  if (!fs.existsSync(utilitiesDir)) {
    fs.mkdirSync(utilitiesDir, { recursive: true });
  }
  const existing = fs.existsSync(outputFile)
    ? fs.readFileSync(outputFile, "utf-8")
    : null;
  if (existing !== css) {
    fs.writeFileSync(outputFile, css);
    return true;
  }
  return false;
}

/**
 * Render the documentation HTML for a single block.
 */
function tokenDocOptions(tokenDocs, type) {
  return (tokenDocs && tokenDocs[type]) || {};
}

function tokenDocBlockEnabled(block, tokenDocs = {}) {
  const options = tokenDocOptions(tokenDocs, block.type);
  if (options.enabled === false) return false;

  if (Array.isArray(options.includeLabels)) {
    return options.includeLabels.includes(block.label);
  }

  if (Array.isArray(options.excludeLabels)) {
    return !options.excludeLabels.includes(block.label);
  }

  return true;
}

function filterTokenDocBlocks(blocks, tokenDocs = {}) {
  return blocks.filter((block) => tokenDocBlockEnabled(block, tokenDocs));
}

function renderBlockDoc(block, tokenDocs = {}) {
  const entry = TYPE_REGISTRY[block.type];
  if (!entry) return null;
  return entry.doc(block, tokenDocOptions(tokenDocs, block.type));
}

/**
 * Produce a stable slug + display title for a block, used as the token swatch
 * filename and sidebar entry. Multiple blocks of the same type are
 * disambiguated by their label.
 */
function blockSlug(block, index) {
  const entry = TYPE_REGISTRY[block.type];
  const labelPart = (block.label || entry.defaultTitle)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Ensure uniqueness even if two blocks share a label.
  return labelPart || `${block.type}-${index}`;
}

function blockTitle(block) {
  const entry = TYPE_REGISTRY[block.type];
  return block.label || (entry ? entry.defaultTitle : block.type);
}

function uniqueSlug(slug, usedSlugs) {
  if (!usedSlugs.has(slug)) return slug;

  let n = 2;
  let candidate = `${slug}-${n}`;
  while (usedSlugs.has(candidate)) {
    n++;
    candidate = `${slug}-${n}`;
  }
  return candidate;
}

/**
 * Merge docs blocks that describe the same token type with the same label. This
 * lets authors keep token blocks near their source CSS while producing one docs
 * page per logical token group.
 */
function mergeTokenBlocksByTypeAndLabel(blocks) {
  const merged = [];
  const byKey = new Map();

  for (const block of blocks) {
    const key = `${block.type}\0${block.label}`;
    let group = byKey.get(key);

    if (!group) {
      group = {
        ...block,
        tokens: [],
        sources: [],
      };
      byKey.set(key, group);
      merged.push(group);
    }

    group.tokens.push(...block.tokens);
    group.sources.push({
      sourceFile: block.sourceFile,
      sourceLine: block.sourceLine,
      parentSelector: block.parentSelector,
      atRuleChain: block.atRuleChain,
    });
  }

  return merged;
}

/**
 * Remove previously generated token docs in tokensUiDir that are no longer
 * wanted. Only deletes files that carry the generated marker AND whose filename
 * is not in `desiredFilenames` — hand-authored files (no marker) are preserved.
 * Returns the number of files removed.
 */
function cleanStaleGeneratedTokenDocs(tokensUiDir, desiredFilenames) {
  if (!fs.existsSync(tokensUiDir)) return 0;
  const desired = new Set(desiredFilenames);
  let removed = 0;

  for (const entry of fs.readdirSync(tokensUiDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    if (desired.has(entry.name)) continue; // still wanted — leave it

    const filePath = path.join(tokensUiDir, entry.name);
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    if (content.includes(GENERATED_TOKEN_DOC_MARKER)) {
      fs.unlinkSync(filePath);
      removed++;
    }
  }

  return removed;
}

/**
 * Generate token documentation HTML files (one per block) into tokensUiDir.
 * Filenames are <slug>.html; collisions try <type>-<slug>.html before falling
 * back to a numeric suffix. Each file carries a generated marker so stale docs (from removed or
 * renamed @swatchkit blocks) are cleaned up on the next build, while leaving
 * any hand-authored files in the directory untouched.
 *
 * Returns { written, removed }.
 */
function generateTokenDocs(blocks, tokensUiDir, tokenDocs = {}) {
  if (!fs.existsSync(tokensUiDir)) {
    fs.mkdirSync(tokensUiDir, { recursive: true });
  }

  // 1. Compute the desired files (slug + marker-prefixed content) up front.
  const usedSlugs = new Map();
  const desired = []; // { filename, content }

  blocks.forEach((block, index) => {
    const html = renderBlockDoc(block, tokenDocs);
    if (!html) return;

    const baseSlug = blockSlug(block, index);
    let slug = baseSlug;
    if (usedSlugs.has(slug)) {
      slug = uniqueSlug(`${block.type}-${baseSlug}`, usedSlugs);
    }
    usedSlugs.set(slug, 1);

    desired.push({
      filename: `${slug}.html`,
      content: `${GENERATED_TOKEN_DOC_MARKER}\n${html}`,
    });
  });

  // 2. Remove stale generated docs no longer in the desired set (marker-gated,
  //    so hand-authored files are preserved).
  const removed = cleanStaleGeneratedTokenDocs(
    tokensUiDir,
    desired.map((d) => d.filename),
  );

  // 3. Write desired files, skipping unchanged ones (keeps watch mode quiet).
  let written = 0;
  for (const { filename, content } of desired) {
    const destPath = path.join(tokensUiDir, filename);
    const existing = fs.existsSync(destPath)
      ? fs.readFileSync(destPath, "utf-8")
      : null;
    if (existing !== content) {
      fs.writeFileSync(destPath, content);
      written++;
    }
  }

  return { written, removed };
}

module.exports = {
  generateUtilities,
  generateUtilitiesCss,
  generateTokenDocs,
  mergeTokenBlocksByTypeAndLabel,
  filterTokenDocBlocks,
  renderBlockDoc,
  blockSlug,
  blockTitle,
  TYPE_REGISTRY,
};
