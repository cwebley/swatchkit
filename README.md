# SwatchKit

**SwatchKit** is a lightweight tool for generating HTML pattern libraries. It acts as a **Pattern Discovery Engine**: it scans your folders for HTML components and stitches them into a documentation site using a layout you control.

It follows the "Magic Folder" principle: drop files in, and a library comes out.

## Quick Start

Try it instantly in any project:

```bash
# 1. Initialize the layout and design tokens
npx swatchkit init

# 2. Build the library
npx swatchkit
```

This will create a `swatches/` folder, generate a `src/tokens/colors.json` file, and build your site to `public/swatchkit/`.

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

### 2. Design Tokens (Colors)
SwatchKit includes a basic **Token Engine**.
*   **Source:** Edit `src/tokens/colors.json`.
*   **Output:** SwatchKit auto-generates `src/css/tokens.css` with CSS variables.
*   **Docs:** It creates `swatches/colors.html` to visualize your palette.

*(More token types like Typography and Spacing coming soon!)*

### 3. Custom Layouts
When you run `swatchkit init`, we create `swatches/_layout.html`.
**You own this file.**
*   Add your own `<link rel="stylesheet" href="/css/app.css">`.
*   Add custom fonts, scripts, or meta tags.
*   Change the HTML structure, logo, or classes.

SwatchKit simply injects the content into the `<!-- PATTERNS -->`, `<!-- SIDEBAR_LINKS -->`, and `<!-- HEAD_EXTRAS -->` placeholders.

### 4. JavaScript Bundling
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
  input: './src/patterns',

  // Override default output directory
  outDir: './dist/docs'
};
```
