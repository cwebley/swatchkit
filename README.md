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

### 3. Intelligent Fluid Logic (New!)

SwatchKit can auto-calculate fluid typography and spacing scales.

**Static vs Fluid:**
*   **Static:** Provide a `value` (e.g. `"16px"`).
*   **Fluid:** Provide `min` and `max` (e.g. `16` and `18`).
*   **Auto-Fluid:** Provide just ONE side (`min` or `max`), and SwatchKit calculates the other using a default ratio (1.125).

**Example (`swatches/tokens/text-sizes.json`):**
```json
{
  "title": "Text Sizes",
  "fluidRatio": 1.25,
  "items": [
    { "name": "base", "value": "1rem" },        // Static: 1rem always
    { "name": "md", "min": 16, "max": 20 },     // Fluid: 16px -> 20px
    { "name": "lg", "max": 24 },                // Auto: 19.2px -> 24px (24 / 1.25)
    { "name": "xl", "min": 32 },                // Auto: 32px -> 40px (32 * 1.25)
    { "name": "jumbo", "max": 64, "fluidRatio": 1.5 } // Auto: 42.6px -> 64px (64 / 1.5)
  ]
}
```

**Generated CSS:**
```css
:root {
  --s-base: 1rem;
  --s-md: clamp(1rem, ... , 1.25rem);
  --s-lg: clamp(1.2rem, ... , 1.5rem);
  --s-xl: clamp(2rem, ... , 2.5rem);
  --s-jumbo: clamp(2.66rem, ... , 4rem);
}
```

### 4. Hybrid Text Leading

You can mix modular scales with manual overrides.

**Example (`swatches/tokens/text-leading.json`):**
```json
{
  "base": 1,
  "ratio": 1.2,
  "items": [
    { "name": "tight", "step": -1 },   // Modular: 1 * (1.2 ^ -1)
    { "name": "flat", "value": 1 },    // Manual: 1
    { "name": "loose", "step": 1 }     // Modular: 1 * (1.2 ^ 1)
  ]
}
```

### 5. CSS Workflow

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

### 6. Custom Layouts
When you run `swatchkit init`, we create `swatches/_layout.html`.
**You own this file.**
*   Link to your own stylesheets.
*   Add custom fonts, scripts, or meta tags.
*   Change the HTML structure, logo, or classes.

SwatchKit injects content into the `<!-- PATTERNS -->`, `<!-- SIDEBAR_LINKS -->`, and `<!-- HEAD_EXTRAS -->` placeholders.

### 7. JavaScript Bundling
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
| `--watch` | `-w` | Watch files and rebuild on change. |
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
  
  // Exclude files (supports glob patterns)
  exclude: ['*.test.js', 'temp*']
};
```
