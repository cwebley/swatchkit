# SwatchKit

**SwatchKit** is a lightweight tool for generating HTML pattern libraries and Design Systems. It acts as a **Pattern Discovery Engine**: it scans your folders for HTML components and stitches them into a documentation site using a layout you control.

It follows the "Magic Folder" principle: drop files in, and a library comes out.

## Quick Start

Try it instantly in any project:

```bash
# 1. Create a config (sets your CSS location and preferences)
npx swatchkit new

# 2. Scaffold layout, tokens, and CSS blueprints
npx swatchkit scaffold

# 3. Build the library
npx swatchkit
```

This will create:

```
my-project/
├── tokens/                      # Design token definitions (you edit these)
│   ├── colors.json
│   ├── fonts.json
│   ├── spacing.json
│   └── ...
├── css/
│   ├── global/
│   │   └── tokens.css           # Generated from tokens/*.json (do not edit)
│   ├── compositions/            # Layout primitives (flow, sidebar, etc.)
│   ├── swatches/                # Component/swatch stylesheets
│   ├── main.css                 # Main stylesheet (you own this)
│   ├── swatchkit-ui.css         # UI styles for the documentation sidebar
│   └── swatchkit-preview.css    # Styles for swatch preview pages
├── swatchkit/
│   ├── _swatchkit.html          # Layout template (you own this)
│   ├── tokens/                  # Visual documentation for design tokens
│   │   ├── colors.html
│   │   ├── typography.html
│   │   └── ...
│   └── swatches/                # Your UI components
│       └── hello/               # Example swatch
│           └── index.html
└── dist/
    └── swatchkit/               # Built pattern library
        ├── index.html
        └── preview/             # Full-screen preview pages
            └── swatches/
                └── hello/
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
├── swatches/            # Section: "Swatches" (default for components)
│   ├── button/
│   │   └── index.html
│   └── card/
│       ├── index.html
│       ├── styles.css   # Sibling assets are copied alongside
│       └── script.js
├── compositions/        # Section: "Compositions"
│   └── sidebar/
│       └── index.html
└── utilities/           # Section: "Utilities"
    └── flow/
        └── index.html
```

- **Subfolders:** Create a new section (e.g. `utilities/` -> "Utilities").
- **Swatch folders:** Each swatch is a folder with an `index.html`. Files next to `index.html` (CSS, JS, images) are copied into the build output as sibling assets, so your `index.html` can reference them with relative paths.
- **Underscore prefix:** Any file or folder prefixed with `_` is ignored at every level (e.g. `_wip/`, `_notes.md`).

### 2. Design Token Engine

SwatchKit scaffolds a design system for you. Edit the JSON files in `tokens/`, and SwatchKit auto-generates `css/global/tokens.css` and `css/utilities/tokens.css`.

**Supported Tokens:**

- **Colors** (`colors.json`): Generates palettes.
- **Fluid Typography** (`text-sizes.json`): Generates `clamp()` based type scales using Utopia methodology.
- **Fluid Spacing** (`spacing.json`): Generates `clamp()` based spacing.
- **Modular Leading** (`text-leading.json`): Generates line-heights using `pow()` modular scales.
- **Fonts & Weights**: Manages font families and weights.

Visual documentation patterns for these tokens live in `swatchkit/tokens/` and are created during scaffold.

### 3. Intelligent Fluid Logic

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

SwatchKit generates `css/global/tokens.css` with your design tokens. Your `css/main.css` imports this file along with layout primitives:

```css
@import "global/index.css";
@import "compositions/index.css";
@import "utilities/index.css";
@import "swatches/index.css";

/* Your app styles below */
```

The pattern library uses **your stylesheet** (`main.css`), so components render exactly as they will in your app.

**Documentation Styling:**
The sidebar and documentation layout are styled by `css/swatchkit-ui.css`. This file is separate from your app styles so you can customize the docs UI without affecting your production CSS.

### 6. Custom Layouts

When you run `swatchkit scaffold`, we create `swatchkit/_swatchkit.html`.
**You own this file.**

- Link to your own stylesheets.
- Add custom fonts, scripts, or meta tags.
- Change the HTML structure, logo, or classes.

SwatchKit injects content into the `<!-- PATTERNS -->`, `<!-- SIDEBAR_LINKS -->`, and `<!-- HEAD_EXTRAS -->` placeholders.

## How It Works

Understanding the build pipeline helps you know which files to edit and which are generated.

### 1. `swatchkit scaffold` (Scaffolding)
Copies "blueprints" into your project to get you started. Scaffold tracks a manifest of every file it manages (token JSONs, CSS blueprints, layout templates) so it can report what's new, changed, or up to date.

*   **Fresh project:** Creates directories and copies all blueprint files.
*   **Already scaffolded:** Prints a status report comparing your files to the latest blueprints. Suggests `--force` if anything has changed.
*   **`--force`:** Overwrites all scaffold-managed files with the latest blueprints. Your custom swatch HTML files and any CSS files without blueprint counterparts are never touched.
*   **`--dry-run`:** Shows what would happen without writing anything.

Files created:
*   **`tokens/*.json`**: These are your **Source of Truth**. You edit these files.
*   **`css/`**: Copies static CSS files (`main.css`, `reset.css`, compositions, etc.). **You own these files**.
*   **`swatchkit/`**: Sets up the documentation structure, layout templates, and token display patterns.

### 2. `swatchkit` (Build Process)
Compiles your documentation site into `dist/swatchkit/`.

1.  **Reads JSON Tokens**: Scans `tokens/*.json` and calculates fluid typography/spacing.
2.  **Generates CSS**: Creates `css/global/tokens.css` and `css/utilities/tokens.css`. **Do not edit these files**; they are overwritten every build.
3.  **Copies Assets**: Copies your `css/` folder (including your manually edited `main.css`, `global/variables.css`, and `global/elements.css`) to the output folder.
4.  **Scans Patterns**: Finds all HTML files in `swatchkit/` and stitches them into the documentation site. Each swatch folder becomes a directory in the output with its own `index.html` and any sibling assets (CSS, JS, images) copied alongside.
5.  **Generates Preview Pages**: Creates full-screen preview pages at `preview/{section}/{id}/index.html` so each swatch can be viewed in isolation.

### Global Styles & Variables
SwatchKit includes sensible defaults in `css/global/variables.css` and `css/global/elements.css`.
*   These are **static files** copied to your project during `scaffold` and **enabled by default**.
*   Variable references use the default token names from `tokens/*.json`. If you rename any tokens, update the `var()` references in these files to match.
*   Both files are yours to edit — add your own variables and element styles freely.

### Upgrading an existing project

Run `swatchkit scaffold` to see a report of what's new or changed versus the latest blueprints. Run `swatchkit scaffold --force` to apply updates — modified files are backed up to `.bak` before being overwritten, so your changes are not lost.

**Note on the `_layout.html` → `_swatchkit.html` rename:** if you had a customized `_layout.html`, scaffold will create a new `_swatchkit.html` from the latest template but will not touch your old `_layout.html`. Copy your customizations from `_layout.html` into `_swatchkit.html` manually, then delete the old file.

### What is Safe to Edit?

| File / Folder | Safe to Edit? | Notes |
| :--- | :--- | :--- |
| `tokens/*.json` | ✅ **YES** | Your source of truth. Safe. |
| `css/main.css` | ✅ **YES** | Your entry point. Safe. |
| `css/global/variables.css` | ✅ **YES** | You own this. Update var() references if you rename tokens. |
| `css/global/elements.css` | ✅ **YES** | You own this. Update var() references if you rename tokens. |
| `css/global/tokens.css` | 🚫 **NO** | Overwritten by every build. |
| `css/utilities/tokens.css` | 🚫 **NO** | Overwritten by every build. |
| `css/swatchkit-ui.css` | ✅ **YES** | Styles for the SwatchKit docs UI. Safe to customize. |
| `css/swatchkit-preview.css` | ✅ **YES** | Styles for swatch preview pages (e.g. the grid background). Safe to customize. |
| `swatchkit/_swatchkit.html`| ✅ **YES** | Safe during normal use. `scaffold --force` overwrites all scaffold-managed files, including this one. |
| `swatchkit/_preview.html`| ✅ **YES** | Same as `_swatchkit.html` — safe unless you run `scaffold --force`. |
| `swatchkit/tokens/*.html`| 🚫 **NO** | Overwritten by `swatchkit build` (visual previews). |

## CLI Reference

```bash
swatchkit [command] [options]
```

### Commands

- `swatchkit new`: Creates `swatchkit.config.js`. Prompts for your CSS directory location. Run this first in any new project.
- `swatchkit new --cssDir ./src/css`: Non-interactive — creates config without prompting.
- `swatchkit new --force`: Overwrites an existing config (backs up the old one).
- `swatchkit scaffold`: Copies CSS blueprints, token JSON files, and layout templates into your project using the settings from `swatchkit.config.js`. If already scaffolded, prints a status report.
- `swatchkit scaffold --force`: Overwrites all scaffold-managed files with the latest blueprints (with backups).
- `swatchkit scaffold --dry-run`: Shows what would be created or changed without writing anything.
- `swatchkit` (Default): Builds the pattern library.

### Flags

| Flag        | Short | Description                                                        |
| :---------- | :---- | :----------------------------------------------------------------- |
| `--watch`   | `-w`  | Watch files and rebuild on change.                                 |
| `--config`  | `-c`  | Path to config file.                                               |
| `--input`   | `-i`  | Pattern directory (Default: `swatchkit/`).                         |
| `--outDir`  | `-o`  | Output directory (Default: `dist/swatchkit`).                      |
| `--cssDir`  |       | CSS directory, for use with `new` (Default: `src/css`).            |
| `--force`   | `-f`  | Overwrite existing files (`new`: config, `scaffold`: blueprints).  |
| `--dry-run` |       | Show what scaffold would create or change, without writing.        |
| `--help`    | `-h`  | Show help message.                                                 |
| `--version` | `-v`  | Show version number.                                               |

## Configuration

`swatchkit.config.js` is created by `swatchkit new`. You can also create it manually in your project root.

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

  // Skip copying CSS into SwatchKit's output directory.
  // When false, SwatchKit references CSS at cssPath instead of copying it.
  // See "Common Workflows" below for when to use this.
  cssCopy: false,

  // Relative path from SwatchKit's HTML to your CSS files.
  // Only relevant when cssCopy is false.
  // Defaults to "../<basename of cssDir>/" (e.g., "../css/" if cssDir is "./src/css").
  // Set explicitly if your deployed CSS lives at a different path.
  cssPath: "../css/",

  // Exclude files (supports glob patterns)
  exclude: ["*.test.js", "temp*"],
};
```

## Common Workflows

### Deploy alongside your project

If your build tool (Vite, Astro, etc.) already outputs CSS to `dist/`, you don't need SwatchKit to copy it again. Set `cssCopy: false` and SwatchKit's HTML will reference your existing CSS.

```javascript
// swatchkit.config.js
module.exports = {
  cssDir: "./src/css",
  cssCopy: false,
};
```

```
dist/
├── css/                    # Your build tool puts CSS here
│   ├── main.css
│   └── global/
│       └── tokens.css
├── index.html              # Your project
└── swatchkit/
    └── index.html          # References ../css/main.css
```

SwatchKit derives the default `cssPath` from your `cssDir` name. If `cssDir` is `"./src/css"`, it defaults to `"../css/"`. If `cssDir` is `"./styles"`, it defaults to `"../styles/"`.

If your deployed CSS ends up somewhere else (e.g., Vite hashes it into `dist/assets/`), set `cssPath` explicitly:

```javascript
module.exports = {
  cssDir: "./src/css",
  cssCopy: false,
  cssPath: "../assets/",
};
```

### Local dev only (self-contained)

If SwatchKit is just a development tool and you don't want it in `dist/`, set `outDir` to a separate directory. Keep `cssCopy` enabled (the default) so the output is fully self-contained.

```javascript
// swatchkit.config.js
module.exports = {
  cssDir: "./src/css",
  outDir: "swatchkit-dist",
};
```

```
my-project/
├── dist/                   # Your production build (no SwatchKit)
│   └── ...
└── swatchkit-dist/         # Self-contained, serve locally during dev
    ├── css/
    │   ├── main.css
    │   └── global/
    │       └── tokens.css
    └── index.html
```

You can serve `swatchkit-dist/` locally during development without affecting your production build.

## Using with a Framework

SwatchKit outputs to `dist/swatchkit/` by default. If your framework (Vite, Astro, etc.) cleans the `dist/` directory during its build, run SwatchKit **after** your framework build:

```json
{
  "scripts": {
    "build": "vite build && swatchkit",
    "dev": "vite dev & swatchkit -w"
  }
}
```

In watch mode, SwatchKit detects when its output directory is deleted by an external tool and automatically rebuilds.

SwatchKit only ever writes inside its own output subdirectory — it will never modify or delete other files in `dist/`.

### Example: Custom Build Pipeline

If you are rolling your own build system (e.g. using `onchange` to copy files), use a tool like `npm-run-all` to run your watchers in parallel.

**swatchkit.config.js**

```javascript
module.exports = {
  cssDir: "./src/css",
  cssCopy: false, // Don't copy CSS (your build tool handles it)
};
```

**package.json**

```json
{
  "scripts": {
    "build": "rm -rf dist && mkdir -p dist && cp -r src/ dist/",
    "swatchkit": "swatchkit",
    "swatchkit:watch": "swatchkit --watch",
    "dev:app": "onchange 'src/**/*' -- npm run build",
    "dev": "npm-run-all --parallel dev:app swatchkit:watch"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5",
    "onchange": "^7.1.0"
  }
}
```

### Watch mode and file watchers

SwatchKit generates files into your source tree during each build — CSS token files (`css/global/tokens.css`, `css/utilities/tokens.css`) and token documentation HTML (`swatchkit/tokens/*.html`). To avoid triggering external file watchers unnecessarily, SwatchKit compares generated content against the existing file and **skips the write when nothing has changed**. This means most rebuilds (e.g., editing an HTML swatch) won't touch your CSS directory at all, preventing infinite rebuild loops when running alongside tools like `onchange`, `chokidar`, or framework dev servers that watch `src/`.

## Acknowledgements

The CSS compositions included by default in SwatchKit are adapted from [Every Layout](https://every-layout.dev/) by Heydon Pickering and Andy Bell. Highly recommend their documentation for a deep dive into their brilliant CSS techniques.
