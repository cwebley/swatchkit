const fs = require('fs');
const path = require('path');
const clampGenerator = require('./utils/clamp-generator');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

function processTokens(tokensDir, cssDir) {
  const outputFile = path.join(cssDir, 'tokens.css');
  let cssContent = ':root {\n';
  let hasTokens = false;
  const tokensContext = {};

  // Helper to process a generic token file
  function processFile(filename, prefix) {
    const filePath = path.join(tokensDir, filename);
    if (!fs.existsSync(filePath)) return;

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.items && Array.isArray(data.items)) {
        hasTokens = true;
        cssContent += `  /* ${data.title || filename} */\n`;
        data.items.forEach(item => {
          if (item.name && item.value) {
            const slug = slugify(item.name);
            cssContent += `  --${prefix}-${slug}: ${item.value};\n`;
          }
        });
        cssContent += '\n';
      }
    } catch (error) {
      console.error(`[SwatchKit] Error processing ${filename}:`, error.message);
    }
  }

  // 1. Process Viewports (First, so they are available for fluid calculations)
  const viewportsFile = path.join(tokensDir, 'viewports.json');
  if (fs.existsSync(viewportsFile)) {
    try {
      const fileContent = fs.readFileSync(viewportsFile, 'utf-8');
      const data = JSON.parse(fileContent);
      
      // Store parsed viewport data for return and use in other generators
      tokensContext.viewports = data;

      hasTokens = true;
      cssContent += `  /* ${data.title || 'Viewports'} */\n`;
      
      Object.keys(data).forEach(key => {
        // Skip metadata keys
        if (['title', 'description', 'meta', '$schema'].includes(key)) return;
        
        const value = data[key];
        const slug = slugify(key);
        // Append 'px' if it's a number
        const cssValue = typeof value === 'number' ? `${value}px` : value;
        
        cssContent += `  --viewport-${slug}: ${cssValue};\n`;
      });
      cssContent += '\n';

    } catch (error) {
      console.error(`[SwatchKit] Error processing viewports.json:`, error.message);
    }
  }

  // 2. Process Colors
  processFile('colors.json', 'color');

  // 3. Process Text Weights
  processFile('text-weights.json', 'weight');

  // 4. Process Text Leading
  const leadingFile = path.join(tokensDir, 'text-leading.json');
  if (fs.existsSync(leadingFile)) {
    try {
      const fileContent = fs.readFileSync(leadingFile, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.base && data.ratio && data.items) {
        hasTokens = true;
        cssContent += `  /* ${data.title || 'Text Leading'} */\n`;
        cssContent += `  --leading-base: ${data.base};\n`;
        cssContent += `  --leading-ratio: ${data.ratio};\n`;

        data.items.forEach(item => {
          if (item.name && item.value !== undefined) {
            const slug = slugify(item.name);
            cssContent += `  --leading-${slug}: calc(var(--leading-base) * pow(var(--leading-ratio), ${item.value}));\n`;
          }
        });
        cssContent += '\n';
      }
    } catch (error) {
      console.error(`[SwatchKit] Error processing text-leading.json:`, error.message);
    }
  }

  // 5. Process Text Sizes
  const textSizesFile = path.join(tokensDir, 'text-sizes.json');
  if (fs.existsSync(textSizesFile)) {
    try {
      const fileContent = fs.readFileSync(textSizesFile, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.items && Array.isArray(data.items)) {
        hasTokens = true;
        cssContent += `  /* ${data.title || 'Text Sizes'} */\n`;

        // Check if we have viewports for fluid generation
        const hasFluidData = tokensContext.viewports && 
                             tokensContext.viewports.min && 
                             tokensContext.viewports.max;
        
        // Filter items that are fluid candidates (have min and max)
        const fluidItems = data.items.filter(item => item.min !== undefined && item.max !== undefined);
        const staticItems = data.items.filter(item => item.min === undefined || item.max === undefined);

        // Process Fluid Items
        if (hasFluidData && fluidItems.length > 0) {
           const fluidTokens = clampGenerator(fluidItems, tokensContext.viewports);
           fluidTokens.forEach(item => {
             const slug = slugify(item.name);
             cssContent += `  --s${slug}: ${item.value};\n`;
           });
        } else if (fluidItems.length > 0) {
            console.warn('[SwatchKit] Fluid text sizes detected but viewports missing. Skipping fluid generation.');
        }

        // Process Static Items (fallback or simple values)
        staticItems.forEach(item => {
          if (item.name && item.value) {
            const slug = slugify(item.name);
            cssContent += `  --s${slug}: ${item.value};\n`;
          }
        });
        
        cssContent += '\n';
      }

    } catch (error) {
      console.error(`[SwatchKit] Error processing text-sizes.json:`, error.message);
    }
  }

  // 6. Process Spacing
  const spacingFile = path.join(tokensDir, 'spacing.json');
  if (fs.existsSync(spacingFile)) {
    try {
      const fileContent = fs.readFileSync(spacingFile, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.items && Array.isArray(data.items)) {
        hasTokens = true;
        cssContent += `  /* ${data.title || 'Spacing'} */\n`;

        // Check if we have viewports for fluid generation
        const hasFluidData = tokensContext.viewports && 
                             tokensContext.viewports.min && 
                             tokensContext.viewports.max;
        
        // Filter items that are fluid candidates (have min and max)
        const fluidItems = data.items.filter(item => item.min !== undefined && item.max !== undefined);
        const staticItems = data.items.filter(item => item.min === undefined || item.max === undefined);

        // Process Fluid Items
        if (hasFluidData && fluidItems.length > 0) {
           const fluidTokens = clampGenerator(fluidItems, tokensContext.viewports);
           fluidTokens.forEach(item => {
             const slug = slugify(item.name);
             cssContent += `  --space-${slug}: ${item.value};\n`;
           });
        } else if (fluidItems.length > 0) {
            console.warn('[SwatchKit] Fluid spacing detected but viewports missing. Skipping fluid generation.');
        }

        // Process Static Items (fallback or simple values)
        staticItems.forEach(item => {
          if (item.name && item.value) {
            const slug = slugify(item.name);
            cssContent += `  --space-${slug}: ${item.value};\n`;
          }
        });
        
        cssContent += '\n';
      }

    } catch (error) {
      console.error(`[SwatchKit] Error processing spacing.json:`, error.message);
    }
  }

  // 7. Process Fonts
  const fontsFile = path.join(tokensDir, 'fonts.json');
  if (fs.existsSync(fontsFile)) {
    try {
      const fileContent = fs.readFileSync(fontsFile, 'utf-8');
      const data = JSON.parse(fileContent);

      if (data.items && Array.isArray(data.items)) {
        hasTokens = true;
        cssContent += `  /* ${data.title || 'Fonts'} */\n`;
        data.items.forEach(item => {
          if (item.name && item.value && Array.isArray(item.value)) {
            const slug = slugify(item.name);
            // Join font names with commas, quoting if necessary (though mostly optional in modern CSS if no special chars)
            // But let's just join them as requested.
            const fontStack = item.value.join(', '); 
            cssContent += `  --font-${slug}: ${fontStack};\n`;
          }
        });
        cssContent += '\n';
      }
    } catch (error) {
      console.error(`[SwatchKit] Error processing fonts.json:`, error.message);
    }
  }

  cssContent += '}\n';

  // If no tokens found, exit early
  if (!hasTokens) {
    return tokensContext;
  }

  // Ensure cssDir exists
  if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, cssContent);
  console.log(`[SwatchKit] Generated ${outputFile}`);
  
  return tokensContext;
}

module.exports = { processTokens };
