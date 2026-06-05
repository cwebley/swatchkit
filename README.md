# SwatchKit

**SwatchKit** is a lightweight tool for generating HTML pattern libraries and design systems. It scans your folders for components, stitches them into a documentation site, and lets you share the same render functions between your app and the library.

The "Magic Folder" principle: drop files in, a library comes out.

## The pattern: one source of truth

The interesting case is when your app and your pattern library share render functions. You write `renderButton()` once, use it in `src/pages/home.js` for the real app, and use it again in `swatchkit/swatches/button/index.js` for the docs. Edit one, both update.

```
my-project/
├── src/
│   ├── components/button.js          # shared renderButton
│   ├── pages/home.js                 # calls renderButton → real app HTML
│   └── css/                          # cssDir — your stylesheet source
├── swatchkit/
│   ├── _swatchkit.html
│   ├── _preview.html
│   └── swatches/
│       └── button/
│           ├── index.js              # calls renderButton → swatch HTML
│           └── demo.js               # sibling asset, copied to dist
├── tokens/                           # design tokens (JSON)
├── scripts/build-site.js             # renders src/pages/home.js → dist/index.html
├── swatchkit.config.js
└── dist/                             # generated
    ├── index.html                    # main app (rendered at build time)
    ├── css/                          # one copy, shared
    └── swatchkit/
        ├── index.html                # references ../css/main.css
        └── preview/...
```

## Quick start

```bash
# 1. Create config (picks CJS or ESM based on package.json#type)
npx swatchkit new --cssDir ./src/css

# 2. Scaffold CSS blueprints, layout templates, token JSONs
npx swatchkit scaffold

# 3. Build
npx swatchkit
```

`swatchkit new` defaults to `./src/css`. If you run `swatchkit` with no config file, the build falls back to `./css`. To pick a different location up front, pass `--cssDir ./css` (or anything else). The build output goes to `dist/swatchkit/` by default.

For real projects, install as a dev dep and add a script:

```bash
npm install -D swatchkit
```

```json
"scripts": {
  "patterns": "swatchkit"
}
```

## The Magic Folder

SwatchKit reads from a single folder (`swatchkit/` by default). Top-level folders under `swatchkit/` become sidebar sections. Folders directly inside those sections become swatches.

```
swatchkit/
├── tokens/                # section: "Design Tokens" (visual previews)
│   ├── colors.html
│   └── typography.html
├── swatches/              # section: "Swatches"
│   ├── button/
│   │   └── index.html
│   └── card/
│       ├── index.html
│       ├── styles.css     # sibling assets copied alongside
│       └── script.js
├── compositions/          # section: "Compositions"
│   └── sidebar/index.html
└── utilities/             # section: "Utilities"
    └── flow/index.html
```

Rules:
- **One level deep.** A swatch is a folder with an `index.html` (or `index.js`, see below). Nested groups like `swatches/components/button/` are not scanned — use `swatches/button/`.
- **Underscore prefix is ignored.** `_wip/`, `_notes.md`, `_swatchkit.html` all stay out of the build.
- **Sibling assets travel with the swatch.** Anything next to `index.html` (CSS, JS, images) is copied to the build output, so your swatch can reference them with relative paths.

## JavaScript swatches

A swatch folder may use `index.js` instead of `index.html` to generate HTML programmatically. This is how you share render functions between your app and the library.

```js
// swatchkit/swatches/button/index.js
import { renderButton } from "../../../src/components/button.js";

const html = String.raw;

export default html`
  <h2>Button</h2>
  ${renderButton({ label: "Save changes" })}
  ${renderButton({ label: "View brand", href: "/brands/aurora/" })}
`;
```

- `index.js` runs at build time and must default-export an HTML string. Non-string defaults fail with a clear error.
- If both `index.js` and `index.html` exist, `index.js` wins.
- `index.js` is reserved for SwatchKit and is not copied as a preview asset. Other `.js` files in the folder are copied (e.g. `demo.js` for browser-side scripts).
- For JavaScript swatches that use `import` / `export`, set `"type": "module"` in your `package.json`. Without that, the swatch runs as CommonJS and `import` syntax is a parse error.

## The renderer contract

A component renderer is a function with a specific shape. This is what makes the shared-between-app-and-library pattern work.

- **Signature:** `function renderX(props) → string`
- **Pure:** no side effects, no I/O, no global state
- **Deterministic:** same input → same output, every time
- **Self-contained output:** the returned string is a complete HTML fragment

Props are an object, destructured with defaults for optional fields. Document the shape with a comment above the function so callers know what to pass.

Naming: `render<ComponentName>`. Verb-first makes the role obvious.

```js
// Pure, deterministic, no imports beyond the function's needs.
export function renderButton({ label, href, variant = "primary" }) {
  const className = variant === "outline" ? "button outline" : "button";
  return href
    ? `<a class="${className}" href="${href}">${label}</a>`
    : `<button class="${className}">${label}</button>`;
}
```

For a full project that uses this contract end-to-end, see [the hand-rolled app setup guide](./docs/app-setup-handrolled.md).

## Two ways to ship CSS

SwatchKit's CSS behavior is controlled by `cssCopy` in the config. The default is `true`; for integrated apps you'll usually want `false`.

### Self-contained (`cssCopy: true`)

SwatchKit copies `cssDir` into `dist/swatchkit/css/`. The pattern library is fully self-contained — you can serve just `dist/swatchkit/` anywhere.

```js
// swatchkit.config.js
export default { cssDir: "./src/css", cssCopy: true };
```

```
dist/swatchkit/
├── css/main.css            ← copied from src/css/
└── index.html
```

Use this when the pattern library is the deliverable, or when you're just kicking the tires.

### Integrated (`cssCopy: false`)

SwatchKit skips the copy and writes `<link>` tags pointing at `cssPath` instead. You put the CSS in `dist/css/` once, the library references it, and your app's HTML references it too. No duplication.

```js
// swatchkit.config.js
export default {
  cssDir: "./src/css",
  cssCopy: false,
  cssPath: "../css/",
};
```

```
dist/
├── index.html              ← your app, links ./css/main.css
├── css/main.css            ← one copy, shared
└── swatchkit/
    ├── index.html          ← links ../css/main.css
    └── preview/...
```

`cssPath` is the path from swatchkit's HTML to the CSS. The default (when omitted) is `../<basename of cssDir>/` — so `cssDir: "./src/css"` defaults to `"../css/"`. For most integrated projects, that's all you need. Set it explicitly only if your build puts CSS somewhere other than `dist/css/`.

For an integrated app, your `package.json` typically chains both steps:

```json
{
  "scripts": {
    "clean": "rm -rf dist",
    "build:site": "node scripts/build-site.js",
    "build:swatchkit": "swatchkit",
    "build:css": "mkdir -p dist && cp -r src/css dist/css",
    "build": "npm run clean && npm run build:site && npm run build:swatchkit && npm run build:css",
    "patterns": "swatchkit"
  }
}
```

`build:swatchkit` runs first so any freshly regenerated `src/css/global/tokens.css` and `src/css/utilities/tokens.css` get picked up by `build:css`. Even with `cssCopy: false`, SwatchKit still regenerates those token files inside `cssDir`; it only skips copying CSS into `dist/swatchkit/css/`.

The `cp -r src/css dist/css` step is fine for development and small projects. For production, replace it with your CSS bundler (Lightning CSS, PostCSS, esbuild, etc.) — the only contract the swatchkit HTML depends on is a stable `dist/css/main.css`.

For a complete walkthrough of an integrated setup (with the full `bundle-css.js`, `bundle-js.js`, and `build-site.js` scripts), see [the hand-rolled app setup guide](./docs/app-setup-handrolled.md).

## Configuration

`swatchkit.config.js` at the project root. All options are optional.

```js
export default {
  // Pattern source directory (default: "./swatchkit")
  input: "./patterns",

  // Output directory (default: "./dist/swatchkit")
  outDir: "./dist/patterns",

  // CSS source directory.
  // `swatchkit new` defaults this to "./src/css".
  // No-config builds fall back to "./css".
  cssDir: "./src/css",

  // Token JSON source directory (default: "./tokens")
  tokensDir: "./src/tokens",

  // Copy cssDir into outDir/css. Set false to reference CSS via cssPath
  // instead. See "Two ways to ship CSS" above.
  cssCopy: true,

  // Path from swatchkit's HTML to the CSS. Only used when cssCopy is false.
  // Default: "../<basename of cssDir>/"
  cssPath: "../css/",

  // Exclude files from the pattern library (supports globs).
  exclude: ["*.test.js"],

  // Toggle individual token HTML swatches (CSS still generated regardless).
  // tokenSwatches: { colors: true, typography: true, spacing: true, ... },

  // Override the default HTML renderers.
  // renderSidebarSection: ({ category, categorySlug, items }) => string,
  // renderSwatchSection: ({ slug, name, category, categorySlug, description, previewHref, content, escapedContent }) => string,
};
```

SwatchKit looks for the config in this order: `swatchkit.config.cjs` (CJS), `swatchkit.config.mjs` (ESM), `swatchkit.config.js` (depends on project's `package.json#type`). Rename to `.cjs` if you need CJS syntax in an ESM project.

## CLI

```bash
swatchkit [command] [options]
```

| Command | What it does |
| :--- | :--- |
| `swatchkit new` | Create `swatchkit.config.js`. Prompts for `cssDir`; pass `--cssDir` to skip the prompt. |
| `swatchkit scaffold` | Copy CSS blueprints, token JSONs, and layout templates. Status report if already scaffolded. |
| `swatchkit scaffold --force` | Overwrite all scaffold-managed files (with `.bak` backups). |
| `swatchkit scaffold --dry-run` | Show what would change, write nothing. |
| `swatchkit` (default) | Build the pattern library. |

| Flag | Short | What it does |
| :--- | :--- | :--- |
| `--watch` | `-w` | Rebuild on file change. |
| `--config` | `-c` | Path to config file. |
| `--input` | `-i` | Pattern source dir (default: `swatchkit/`). |
| `--outDir` | `-o` | Output dir (default: `dist/swatchkit`). |
| `--cssDir` | | CSS dir for `new` (default prompt: `src/css`). |
| `--force` | `-f` | Overwrite (`new`: config, `scaffold`: blueprints). |
| `--dry-run` | | `scaffold`: report without writing. |
| `--help` | `-h` | |
| `--version` | `-v` | |

## How it works

`swatchkit` (the build command) does four things:

1. **Reads `tokens/*.json`** and regenerates `css/global/tokens.css` and `css/utilities/tokens.css` if the content changed. These are the auto-generated CSS files in your source tree. SwatchKit also regenerates token-documentation HTML under `swatchkit/tokens/` on every build.
2. **Copies CSS** from `cssDir` to `outDir/css` (only when `cssCopy: true`).
3. **Scans `swatchkit/`** for swatches, renders each one. Static `index.html` swatches go through unchanged. Dynamic `index.js` swatches are imported and executed for their HTML. Sibling assets are copied alongside.
4. **Writes** `outDir/index.html` (the library) and one `outDir/preview/{section}/{id}/index.html` per swatch (full-screen previews).

In watch mode, SwatchKit compares generated content against existing files and **skips the write when nothing has changed** — so most rebuilds don't touch your CSS directory, and there's no infinite-rebuild loop when running alongside `onchange` or framework dev servers.

## What swatchkit owns vs what you own

| Path | Owned by | Notes |
| :--- | :--- | :--- |
| `tokens/*.json` | you | Source of truth for design tokens. |
| `src/css/main.css` | you | Your entry point. |
| `src/css/global/variables.css` | you | Edit `var()` references if you rename tokens. |
| `src/css/global/elements.css` | you | Same. |
| `src/css/global/tokens.css` | swatchkit | Regenerated every build. |
| `src/css/utilities/tokens.css` | swatchkit | Regenerated every build. |
| `src/css/swatchkit-ui.css` | you | Docs UI styling. Safe to customize. |
| `src/css/swatchkit-preview.css` | you | Preview page styling. Safe to customize. |
| `swatchkit/_swatchkit.html` | you | Layout template. `scaffold --force` overwrites it. |
| `swatchkit/_preview.html` | you | Preview template. Same caveat. |
| `swatchkit/tokens/*.html` | swatchkit | Regenerated every build. |
| `swatchkit/swatches/**/index.html` | you | Your swatches. |
| `swatchkit/swatches/**/index.js` | you | Your JS swatches. |
| `swatchkit/swatches/**/description.html` | you | Optional, shown above the iframe in the library. |
| `swatchkit/swatches/**/*` (other files) | you | Copied as sibling assets. |

## Using with a framework

SwatchKit only ever writes inside its own output directory — never the rest of `dist/`. If your framework (Vite, Astro, etc.) cleans `dist/` on build, run it first and swatchkit after:

```json
"scripts": {
  "build": "vite build && swatchkit"
}
```

In watch mode, SwatchKit polls for its output directory and rebuilds if it was wiped by an external tool.

## Design tokens (optional)

Edit `tokens/*.json` and SwatchKit auto-generates CSS. Supported token types:

- **Colors** (`colors.json`): palettes
- **Fluid typography** (`text-sizes.json`): `clamp()`-based type scales
- **Fluid spacing** (`spacing.json`): `clamp()`-based spacing
- **Modular text leading** (`text-leading.json`): line-height via `pow()` scales
- **Fonts & weights** (`fonts.json`, `text-weights.json`)
- **Viewports** (`viewports.json`): breakpoints used by fluid scales

For `text-sizes.json` and `spacing.json`, you can specify static, fluid, or auto-fluid values:

```json
{
  "title": "Text Sizes",
  "fluidRatio": 1.25,
  "items": [
    { "name": "base", "value": "1rem" },
    { "name": "md", "min": 16, "max": 20 },
    { "name": "lg", "max": 24 }
  ]
}
```

`value` is static. `min`/`max` is fully fluid. Just one side triggers auto-fluid (other side derived from `fluidRatio`, default 1.125).

## Acknowledgements

The CSS compositions included by default are adapted from [Every Layout](https://every-layout.dev/) by Heydon Pickering and Andy Bell.
