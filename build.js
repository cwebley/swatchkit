const fs = require('fs');
const path = require('path');

const config = {
  srcDir: path.join(__dirname, 'src'),
  cssDir: path.join(__dirname, 'src/css'),
  patternsDir: path.join(__dirname, 'src/patterns'),
  layoutFile: path.join(__dirname, 'src/layout.html'),
  distDir: path.join(__dirname, 'dist'),
  distCssDir: path.join(__dirname, 'dist/css'),
  distJsDir: path.join(__dirname, 'dist/js'),
  outputFile: path.join(__dirname, 'dist/index.html'),
  outputJsFile: path.join(__dirname, 'dist/js/patterns.js')
};

function build() {
  console.log('[SwatchKit] Starting build...');

  // 1. Ensure dist directories exist
  [config.distDir, config.distCssDir, config.distJsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 2. Copy CSS files
  console.log('Copying CSS...');
  if (fs.existsSync(config.cssDir)) {
      const cssFiles = fs.readdirSync(config.cssDir).filter(file => file.endsWith('.css'));
      cssFiles.forEach(file => {
          fs.copyFileSync(path.join(config.cssDir, file), path.join(config.distCssDir, file));
      });
  }

  // 3. Read patterns & JS
  console.log('Processing patterns...');
  const patterns = [];
  const scripts = [];

  if (fs.existsSync(config.patternsDir)) {
    const items = fs.readdirSync(config.patternsDir);

    items.forEach(item => {
      const itemPath = path.join(config.patternsDir, item);
      const stat = fs.statSync(itemPath);
      
      let name, content, id;

      // Handle Directory Pattern (Folder with index.html + optional JS files)
      if (stat.isDirectory()) {
        const indexFile = path.join(itemPath, 'index.html');
        
        if (fs.existsSync(indexFile)) {
          name = item;
          id = item;
          content = fs.readFileSync(indexFile, 'utf-8');

          // Find all .js files in this directory
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
      // Handle Single File Pattern (.html)
      else if (item.endsWith('.html')) {
        name = path.basename(item, '.html');
        id = name;
        content = fs.readFileSync(itemPath, 'utf-8');
      }

      if (name && content) {
        patterns.push({ name, id, content });
      }
    });
  }

  // 4. Generate HTML fragments
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

  // 5. Write JS Bundle
  if (scripts.length > 0) {
    fs.writeFileSync(config.outputJsFile, scripts.join('\n'));
    console.log(`Bundled ${scripts.length} scripts to ${config.outputJsFile}`);
  } else {
    // Write empty file if no scripts so browser doesn't 404
    fs.writeFileSync(config.outputJsFile, '// No pattern scripts found');
  }

  // 6. Read layout and replace placeholders
  let layout = fs.readFileSync(config.layoutFile, 'utf-8');
  
  const finalHtml = layout
    .replace('<!-- SIDEBAR_LINKS -->', sidebarLinks)
    .replace('<!-- PATTERNS -->', patternBlocks);

  // 7. Write output
  fs.writeFileSync(config.outputFile, finalHtml);
  
  console.log(`Build complete! Generated ${config.outputFile}`);
}

build();