/**
 * Token HTML Generators
 * 
 * These functions read JSON token files and generate HTML
 * for the SwatchKit UI that references the actual token names.
 */

const fs = require('fs');
const path = require('path');

// Inline script that resolves CSS custom property values and annotates
// .token-value elements with their computed value (e.g. "(#3b82f6)").
// Included directly in any generated HTML fragment that uses .token-value
// so the fragment is self-contained and doesn't depend on a shared bundle.
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

  const rows = data.items.map(item => {
    const varName = `--${item.name}`;
    return `      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: nowrap;">
            <div style="background: ${item.value}; width: 2rem; height: 2rem; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0;" role="presentation"></div>
            <strong>${item.name}</strong>
          </div>
        </td>
        <td><code>${item.value}</code></td>
        <td><code>var(${varName})</code></td>
        <td><code>.color:${item.name}</code></td>
        <td><code>.background-color:${item.name}</code></td>
      </tr>`;
  }).join('\n');

  return `<table class="color-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Hex code</th>
      <th>Custom Property</th>
      <th>Color Utility Class</th>
      <th>BG Utility Class</th>
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

/**
 * Generate typography.html from text-sizes.json
 */
function generateTypography(tokensDir) {
  const data = readTokenFile(tokensDir, 'text-sizes.json');
  if (!data || !data.items) return null;

  const steps = data.items.map(item => {
    const varName = `--${item.name}`;
    const min = item.min !== undefined ? `${item.min}px` : '—';
    const max = item.max !== undefined ? `${item.max}px` : '—';
    return `  <div class="type-step">
    <div class="type-sample" style="font-size: var(${varName})">${item.name}</div>
    <div class="type-meta">
      <code>${varName}</code>
      <code>.font-size:${item.name}</code>
      <span class="token-value" data-var="${varName}"></span>
      <span>${min} / ${max}</span>
    </div>
  </div>`;
  }).join('\n');

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

/**
 * Generate spacing.html from spacing.json
 */
function generateSpacing(tokensDir) {
  const data = readTokenFile(tokensDir, 'spacing.json');
  if (!data || !data.items) return null;

  const scaleRows = data.items.map(item => {
    const varName = `--${item.name}`;
    const minVal = item.min !== undefined ? `${item.min}px` : (item.value || '—');
    const maxVal = item.max !== undefined ? `${item.max}px` : (item.value || '—');
    return `      <tr>
        <td>
          <div class="spacing-swatch" style="height: var(${varName});"></div>
        </td>
        <td><strong>${item.name}</strong></td>
        <td><code>var(${varName})</code></td>
        <td>${minVal}</td>
        <td>${maxVal}</td>
      </tr>`;
  }).join('\n');

  const usageRows = data.items.map(item => {
    const slug = item.name;
    return `      <tr>
        <td><code>var(--${slug})</code></td>
        <td><code>.padding-block:${slug}</code></td>
        <td><code>.padding-inline:${slug}</code></td>
        <td><code>.margin-block:${slug}</code></td>
        <td><code>.flow-space:${slug}</code></td>
        <td><code>.gutter:${slug}</code></td>
        <td><code>.region-space:${slug}</code></td>
      </tr>`;
  }).join('\n');

  return `<h2 style="font-family: monospace; margin-bottom: 0.5rem;">Scale</h2>
<table class="spacing-table">
  <thead>
    <tr>
      <th width="120px"></th>
      <th>Name</th>
      <th>Custom Property</th>
      <th>Min</th>
      <th>Max</th>
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
</div>
${TOKEN_DISPLAY_SCRIPT}`;
}

/**
 * Generate text-weights.html from text-weights.json
 */
function generateTextWeights(tokensDir) {
  const data = readTokenFile(tokensDir, 'text-weights.json');
  if (!data || !data.items) return null;

  const weights = data.items.map(item => {
    const varName = `--${item.name}`;
    return `  <div class="weight-step">
    <div class="weight-sample" style="font-weight: var(${varName})">The quick brown fox jumps over the lazy dog.</div>
    <div class="weight-meta">
      <code>${varName}</code>
      <code>.font-weight:${item.name}</code>
      <span>${item.value}</span>
    </div>
  </div>`;
  }).join('\n');

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
      <code>${varName}</code>
      <code>.line-height:${item.name}</code>
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
</style>
${TOKEN_DISPLAY_SCRIPT}`;
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
    const barWidth = typeof item.value === 'number' ? `${item.value}px` : '100%';
    return `  <div class="viewport-item">
    <div class="viewport-bar" style="width: ${barWidth}">
      <span class="viewport-meta">
        <strong>${item.name}</strong>
        <code>var(${varName})</code>
        <span class="viewport-value">${displayValue}</span>
      </span>
    </div>
  </div>`;
  }).join('\n');

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

/**
 * Generate all token HTML files and write them to the tokens UI directory
 */
function generateTokenSwatches(tokensDir, tokensUiDir, tokenSwatches = {}) {
  const enabled = {
    colors: true,
    typography: true,
    spacing: true,
    fonts: true,
    textWeights: true,
    textLeading: true,
    viewports: true,
    ...tokenSwatches,
  };

  const generators = [
    { filename: 'colors.html', fn: generateColors, key: 'colors' },
    { filename: 'typography.html', fn: generateTypography, key: 'typography' },
    { filename: 'spacing.html', fn: generateSpacing, key: 'spacing' },
    { filename: 'fonts.html', fn: generateFonts, key: 'fonts' },
    { filename: 'text-weights.html', fn: generateTextWeights, key: 'textWeights' },
    { filename: 'text-leading.html', fn: generateTextLeading, key: 'textLeading' },
    { filename: 'viewports.html', fn: generateViewports, key: 'viewports' },
  ].filter(g => enabled[g.key] !== false);

  let generated = 0;

  generators.forEach(({ filename, fn }) => {
    const html = fn(tokensDir);
    if (html) {
      const destPath = path.join(tokensUiDir, filename);
      const existing = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf-8') : null;
      if (existing !== html) {
        fs.writeFileSync(destPath, html);
        generated++;
      }
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
