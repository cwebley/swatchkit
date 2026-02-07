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
├── tokens/                 # Design token definitions (you edit these)
│   ├── colors.json
│   ├── fonts.json
│   ├── spacing.json
│   └── ...
├── css/
│   ├── compositions/       # Layout primitives (flow, sidebar, etc.)
│   ├── tokens.css          # Generated from tokens/*.json
│   ├── styles.css          # Starter stylesheet (imports tokens + compositions)
│   └── swatchkit-ui.css    # UI styles for the documentation sidebar
├── swatchkit/
│   ├── _layout.html        # Layout template (you own this)
│   └── tokens/             # Visual documentation for design tokens
│       ├── colors.html
│       ├── typography.html
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

### 1. The Magic Folder & Project Structure

By default, SwatchKit looks for a `swatchkit/` folder in your project root.

**Organize by Folder:**
SwatchKit automatically turns subfolders into sections in the documentation sidebar.

```
swatchkit/
├── tokens/              # Section: "Design Tokens" (visual previews)
│   ├── colors.html
│   └── typography.html
├── components/          # Section: "Components"
│   ├── button.html
│   └── card/
│       └── index.html
├── compositions/        # Section: "Compositions"
│   └── sidebar.html
└── utilities/           # Section: "Utilities"
    └── flow.html
```

- **Files at root:** Go to the "Patterns" section.
- **Subfolders:** Create a new section (e.g. `utilities/` -> "Utilities").

### 2. Design Token Engine

SwatchKit scaffolds a design system for you. Edit the JSON files in `tokens/`, and SwatchKit auto-generates `css/tokens.css`.

**Supported Tokens:**

- **Colors** (`colors.json`): Generates palettes.
- **Fluid Typography** (`text-sizes.json`): Generates `clamp()` based type scales using Utopia methodology.
- **Fluid Spacing** (`spacing.json`): Generates `clamp()` based spacing.
- **Modular Leading** (`text-leading.json`): Generates line-heights using `pow()` modular scales.
- **Fonts & Weights**: Manages font families and weights.

Visual documentation patterns for these tokens live in `swatchkit/tokens/` and are created during init.

### 3. Intelligent Fluid Logic (New!)

SwatchKit can auto-calculate fluid typography and spacing scales.

**Static vs Fluid:**

- **Static:** Provide a `value` (e.g. `"16px"`).
- **Fluid:** Provide `min` and `max` (e.g. `16` and `18`).
- **Auto-Fluid:** Provide just ONE side (`min` or `max`), and SwatchKit calculates the other using a default ratio (1.125).

**Example (`tokens/text-sizes.json`):**

```json
{
  "title": "Text Sizes",
  "fluidRatio": 1.25,
  "items": [
    { "name": "base", "value": "1rem" }, // Static: 1rem always
    { "name": "md", "min": 16, "max": 20 }, // Fluid: 16px -> 20px
    { "name": "lg", "max": 24 }, // Auto: 19.2px -> 24px (24 / 1.25)
    { "name": "xl", "min": 32 }, // Auto: 32px -> 40px (32 * 1.25)
    { "name": "jumbo", "max": 64, "fluidRatio": 1.5 } // Auto: 42.6px -> 64px (64 / 1.5)
  ]
}
```

**Generated CSS:**

```css
:root {
  --s-base: 1rem;
  --s-md: clamp(1rem, ..., 1.25rem);
  --s-lg: clamp(1.2rem, ..., 1.5rem);
  --s-xl: clamp(2rem, ..., 2.5rem);
  --s-jumbo: clamp(2.66rem, ..., 4rem);
}
```

### 4. Hybrid Text Leading

You can mix modular scales with manual overrides.

**Example (`tokens/text-leading.json`):**

```json
{
  "base": 1,
  "ratio": 1.2,
  "items": [
    { "name": "tight", "step": -1 }, // Modular: 1 * (1.2 ^ -1)
    { "name": "flat", "value": 1 }, // Manual: 1
    { "name": "loose", "step": 1 } // Modular: 1 * (1.2 ^ 1)
  ]
}
```

### 5. CSS Workflow

SwatchKit generates `css/tokens.css` with your design tokens. The starter `css/styles.css` imports this file along with layout primitives:

```css
@import 'tokens.css';
@import 'compositions/index.css';

body {
  font-family: var(--font-base);
  color: var(--color-dark);
}
```

The pattern library uses **your stylesheet** (`styles.css`), so components render exactly as they will in your app.

**Documentation Styling:**
The sidebar and documentation layout are styled by `css/swatchkit-ui.css`. This file is separate from your app styles so you can customize the docs UI without affecting your production CSS.

### 6. Custom Layouts

When you run `swatchkit init`, we create `swatchkit/_layout.html`.
**You own this file.**

- Link to your own stylesheets.
- Add custom fonts, scripts, or meta tags.
- Change the HTML structure, logo, or classes.

SwatchKit injects content into the `<!-- PATTERNS -->`, `<!-- SIDEBAR_LINKS -->`, and `<!-- HEAD_EXTRAS -->` placeholders.

### 7. JavaScript Bundling

If your component needs client-side JS:

1. Create a folder: `swatchkit/carousel/`.
2. Add `index.html` (Markup).
3. Add `script.js` (Logic).

SwatchKit automatically bundles your JS files, wraps them in a safety scope (IIFE), and injects them into the final build.

## CLI Reference

```bash
swatchkit [command] [options]
```

### Commands

- `swatchkit` (Default): Builds the library.
- `swatchkit init`: Scaffolds the layout and token files.

### Flags

| Flag       | Short | Description                                     |
| :--------- | :---- | :---------------------------------------------- |
| `--watch`  | `-w`  | Watch files and rebuild on change.              |
| `--config` | `-c`  | Path to config file.                            |
| `--input`  | `-i`  | Pattern directory (Default: `swatchkit/`).      |
| `--outDir` | `-o`  | Output directory (Default: `public/swatchkit`). |
| `--force`  | `-f`  | Overwrite layout file during init.              |

## Configuration

Optional. Create `swatchkit.config.js` in your root for persistent settings.

```javascript
module.exports = {
  // Override default pattern directory
  input: "./patterns",

  // Override default output directory
  outDir: "./dist/patterns",

  // Override CSS directory
  cssDir: "./assets/css",

  // Override tokens directory (JSON token definitions)
  tokensDir: "./src/tokens",

  // Exclude files (supports glob patterns)
  exclude: ["*.test.js", "temp*"],
};
```

## Acknowledgements

The CSS compositions included by default in SwatchKit are adapted from [Every Layout](https://every-layout.dev/) by Heydon Pickering and Andy Bell. Highly recommend their documentation for a deep dive into their brilliant CSS techniques.
