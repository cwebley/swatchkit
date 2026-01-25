# SwatchKit

**SwatchKit** is a lightweight tool for generating HTML pattern libraries and Design Systems. It acts as a **Pattern Discovery Engine**: it scans your folders for HTML components and stitches them into a documentation site using a layout you control.

It follows the "Magic Folder" principle: drop files in, and a library comes out.

## Quick Start

Try it instantly in any project:

```bash
# 1. Initialize the layout and design tokens
npx swatchkit init

# 2. Build the library
npx swatchkit
```

This will create:

```
my-project/
├── css/
│   ├── tokens.css          # Generated design tokens (CSS custom properties)
│   └── styles.css          # Starter stylesheet (imports tokens.css)
├── swatches/
│   ├── _layout.html        # Layout template (you own this)
│   └── tokens/             # Token definitions + documentation patterns
│       ├── colors.json
│       ├── colors.html
│       └── ...
└── public/
    └── swatchkit/          # Built pattern library
        └── index.html
```

---

## Project Setup (Recommended)

For real projects, install SwatchKit as a development dependency to lock the version.

```bash
npm install -D swatchkit
```

Then add it to your `package.json` scripts:

```json
"scripts": {
  "patterns": "swatchkit"
}
```

## Features

### 1. The Magic Folder
By default, SwatchKit looks for a `swatches/` folder in your project root.
*   **Single File:** Drop `card.html` into `swatches/`. It appears in the library.
*   **Component Folder:** Drop a folder like `swatches/carousel/` containing `index.html`. It works the same way.

### 2. Design Token Engine
SwatchKit scaffolds a design system for you. Edit the JSON files in `swatches/tokens/`, and SwatchKit auto-generates `css/tokens.css`.

**Supported Tokens:**
*   **Colors** (`colors.json`): Generates palettes.
*   **Fluid Typography** (`text-sizes.json`): Generates `clamp()` based type scales using Utopia methodology.
*   **Fluid Spacing** (`spacing.json`): Generates `clamp()` based spacing.
*   **Modular Leading** (`text-leading.json`): Generates line-heights using `pow()` modular scales.
*   **Fonts & Weights**: Manages font families and weights.

Documentation patterns for these are automatically created alongside the JSON files.

### 3. CSS Workflow

SwatchKit generates `css/tokens.css` with your design tokens as CSS custom properties. The starter `css/styles.css` imports this file:

```css
@import 'tokens.css';

body {
  font-family: var(--font-base);
  color: var(--color-dark);
}

/* Add your app styles here */
```

The pattern library uses **your stylesheet**, so components render exactly as they will in your app.

### 4. Custom Layouts
When you run `swatchkit init`, we create `swatches/_layout.html`.
**You own this file.**
*   Link to your own stylesheets.
*   Add custom fonts, scripts, or meta tags.
*   Change the HTML structure, logo, or classes.

SwatchKit injects content into the `<!-- PATTERNS -->`, `<!-- SIDEBAR_LINKS -->`, and `<!-- HEAD_EXTRAS -->` placeholders.

### 5. JavaScript Bundling
If your component needs client-side JS:
1.  Create a folder: `swatches/carousel/`.
2.  Add `index.html` (Markup).
3.  Add `script.js` (Logic).

SwatchKit automatically bundles your JS files, wraps them in a safety scope (IIFE), and injects them into the final build.

## CLI Reference

```bash
swatchkit [command] [options]
```

### Commands
*   `swatchkit` (Default): Builds the library.
*   `swatchkit init`: Scaffolds the layout and token files.

### Flags
| Flag | Short | Description |
| :--- | :--- | :--- |
| `--watch` | `-w` | Watch mode (coming soon). |
| `--config` | `-c` | Path to config file. |
| `--input` | `-i` | Pattern directory (Default: `swatches/`). |
| `--outDir` | `-o` | Output directory (Default: `public/swatchkit`). |
| `--force` | `-f` | Overwrite layout file during init. |

## Configuration
Optional. Create `swatchkit.config.js` in your root for persistent settings.

```javascript
module.exports = {
  // Override default pattern directory
  input: './patterns',

  // Override default output directory
  outDir: './dist/patterns',
  
  // Override CSS directory
  css: './assets/css',
  
  // Override token settings
  tokens: {
    input: './design-tokens',    // Where token JSON files live
    leading: {
      ratio: 1.25,               // Modular scale ratio
      base: 1
    }
  }
};
```
