/**
 * Token HTML Generators
 * 
 * These functions read JSON token files and generate HTML
 * for the SwatchKit UI that references the actual token names.
 */

const fs = require('fs');
const path = require('path');

/**
 * Read and parse a JSON token file
 */
function readTokenFile(tokensDir, filename) {
  const filePath = path.join(tokensDir, filename);
  if (!fs.existsSync(filePath)) return null;
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[SwatchKit] Error reading ${filename}:`, error.message);
    return null;
  }
}

/**
 * Generate colors.html from colors.json
 */
function generateColors(tokensDir) {
  const data = readTokenFile(tokensDir, 'colors.json');
  if (!data || !data.items) return null;

  const swatches = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div class="swatch">
    <div class="swatch-color" style="background-color: var(${varName});"></div>
    <div class="swatch-info">
      <strong>${item.name}</strong><br>
      var(${varName})
    </div>
  </div>`;
  }).join('\n');

  return `<style>
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }
  .swatch {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }
  .swatch-color {
    height: 100px;
    width: 100%;
  }
  .swatch-info {
    padding: 0.5rem;
    font-family: monospace;
    font-size: 0.9rem;
    background: #f9f9f9;
  }
</style>

<div class="swatch-grid">
${swatches}
</div>`;
}

/**
 * Generate typography.html from text-sizes.json
 */
function generateTypography(tokensDir) {
  const data = readTokenFile(tokensDir, 'text-sizes.json');
  if (!data || !data.items) return null;

  const steps = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div style="font-size: var(${varName})">${item.name} <span class="token-value" data-var="${varName}"></span></div>`;
  }).join('\n');

  return `<style>
  .type-ladder > * {
    margin-bottom: 1.5rem;
    line-height: 1.2;
  }
  .type-ladder .token-value {
    display: block;
    font-size: 0.875rem;
    font-weight: normal;
    color: #666;
    margin-top: 0.25rem;
    font-family: monospace;
  }
</style>
<div class="type-ladder">
${steps}
</div>`;
}

/**
 * Generate spacing.html from spacing.json
 */
function generateSpacing(tokensDir) {
  const data = readTokenFile(tokensDir, 'spacing.json');
  if (!data || !data.items) return null;

  const items = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div class="spacing-item">
    <div class="spacing-box" style="width: var(${varName}); height: var(${varName});"></div>
    <div><strong>${item.name}</strong> <code>var(${varName})</code> <span class="token-value" data-var="${varName}"></span></div>
  </div>`;
  }).join('\n');

  return `<style>
  .spacing-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .spacing-item {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .spacing-box {
    background: var(--color-primary, #000);
    min-height: 10px;
  }
</style>
<div class="spacing-list">
${items}
</div>`;
}

/**
 * Generate fonts.html from fonts.json
 */
function generateFonts(tokensDir) {
  const data = readTokenFile(tokensDir, 'fonts.json');
  if (!data || !data.items) return null;

  const stacks = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div style="font-family: var(${varName}); margin-bottom: 2rem;">
    <strong>${item.name}</strong> <code class="token-value" data-var="${varName}">var(${varName})</code>
    <p>The quick brown fox jumps over the lazy dog.</p>
  </div>`;
  }).join('\n');

  return `<div class="font-stack">
${stacks}
</div>`;
}

/**
 * Generate text-weights.html from text-weights.json
 */
function generateTextWeights(tokensDir) {
  const data = readTokenFile(tokensDir, 'text-weights.json');
  if (!data || !data.items) return null;

  const weights = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div style="font-weight: var(${varName})">
    ${item.name} (${item.value}) - The quick brown fox jumps over the lazy dog.
  </div>`;
  }).join('\n');

  return `<div style="font-family: sans-serif; display: grid; gap: 1rem;">
${weights}
</div>`;
}

/**
 * Generate text-leading.html from text-leading.json
 */
function generateTextLeading(tokensDir) {
  const data = readTokenFile(tokensDir, 'text-leading.json');
  if (!data || !data.items) return null;

  const loremText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;

  const leadings = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div style="line-height: var(${varName})">
    <div class="meta">
      <strong>${item.name}</strong>
      <code>var(${varName})</code>
      <span class="token-value" data-var="${varName}"></span>
    </div>
    <p>${loremText}</p>
  </div>`;
  }).join('\n\n');

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
</style>`;
}

/**
 * Generate viewports.html from viewports.json
 */
function generateViewports(tokensDir) {
  const data = readTokenFile(tokensDir, 'viewports.json');
  if (!data || !data.items) return null;

  const items = data.items.map(item => {
    const varName = `--${item.name}`;
    const displayValue = typeof item.value === 'number' ? `${item.value}px` : item.value;
    return `  <div class="viewport-item">
    <strong>${item.name}</strong>
    <code>var(${varName})</code>
    <span class="viewport-value">${displayValue}</span>
  </div>`;
  }).join('\n');

  return `<style>
  .viewport-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: monospace;
  }
  .viewport-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
  }
  .viewport-item strong {
    min-width: 120px;
  }
  .viewport-item code {
    color: #666;
  }
  .viewport-value {
    margin-left: auto;
    font-weight: bold;
  }
</style>
<div class="viewport-list">
${items}
</div>`;
}

/**
 * Generate all token HTML files and write them to the tokens UI directory
 */
function generateTokenSwatches(tokensDir, tokensUiDir) {
  const generators = [
    { filename: 'colors.html', fn: generateColors },
    { filename: 'typography.html', fn: generateTypography },
    { filename: 'spacing.html', fn: generateSpacing },
    { filename: 'fonts.html', fn: generateFonts },
    { filename: 'text-weights.html', fn: generateTextWeights },
    { filename: 'text-leading.html', fn: generateTextLeading },
    { filename: 'viewports.html', fn: generateViewports },
  ];

  let generated = 0;

  generators.forEach(({ filename, fn }) => {
    const html = fn(tokensDir);
    if (html) {
      const destPath = path.join(tokensUiDir, filename);
      fs.writeFileSync(destPath, html);
      generated++;
    }
  });

  return generated;
}

module.exports = {
  generateColors,
  generateTypography,
  generateSpacing,
  generateFonts,
  generateTextWeights,
  generateTextLeading,
  generateViewports,
  generateTokenSwatches,
};
