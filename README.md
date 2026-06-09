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
│       └── global/tokens.css         # design tokens (CSS, with @swatchkit blocks)
├── swatchkit/
│   ├── _swatchkit.html
│   ├── _preview.html
│   └── swatches/
│       └── button/
│           ├── index.js              # calls renderButton → swatch HTML
│           └── demo.js               # sibling asset, copied to dist
├── scripts/                          # build scripts (from `init --app`)
│   ├── build-site.js                 # renders src/pages/home.js → dist/index.html
│   └── build-assets.js               # esbuild bundles CSS + JS
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
# 1. Create config + scaffold CSS blueprints, layout templates, starter tokens
#    (picks CJS or ESM config based on package.json#type)
npx swatchkit init --cssDir ./src/css

# 2. Build
npx swatchkit
```

`swatchkit init` prompts for `cssDir` (default `./src/css`) when `--cssDir` is omitted, writes `swatchkit.config.js`, and scaffolds the project in one step. If you run `swatchkit` with no config file, the build falls back to `./css`. The build output goes to `dist/swatchkit/` by default.

### Full app in one command

To scaffold a complete integrated app — esbuild build scripts, shared
`renderButton`/`renderCard` functions, a home page, two example swatches, and a
watch-enabled `package.json` — add `--app`:

```bash
mkdir my-app && cd my-app
npm install -D swatchkit esbuild
npx swatchkit init --app
npm install
npm run dev      # builds, watches, serves at http://localhost:8080
```

The app is at `/`, the pattern library at `/swatchkit/`, both sharing one bundled
CSS file. See [the hand-rolled app setup guide](./docs/app-setup-handrolled.md).

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
├── tokens/                # section: "Design Tokens" (generated — see below)
│   ├── colors.html
│   └── text-sizes.html
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
- **`swatchkit/tokens/*.html` is generated**, not hand-written. SwatchKit regenerates it on every build from your `@swatchkit` token blocks (see [Design tokens](#design-tokens)). Don't edit those files.

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

For an integrated app, your `package.json` typically chains both steps. The canonical setup uses esbuild for the CSS+JS bundling step — see the [hand-rolled app setup guide](./docs/app-setup-handrolled.md) for the full reference:

```json
{
  "scripts": {
    "clean": "node scripts/clean.js",
    "build:site": "node scripts/build-site.js",
    "build:swatchkit": "swatchkit",
    "build:assets": "node scripts/build-assets.js",
    "build": "npm run clean && npm run build:site && npm run build:swatchkit && npm run build:assets",
    "patterns": "swatchkit"
  }
}
```

`build:swatchkit` runs first so the freshly regenerated `src/css/utilities/utilities.css` (the utility classes derived from your `@swatchkit` token blocks) gets picked up by `build:assets`. Even with `cssCopy: false`, SwatchKit still regenerates that utilities file inside `cssDir`; it only skips copying CSS into `dist/swatchkit/css/`. Your `tokens.css` is never modified — it's the source of truth.

If you just want to kick the tires: `cp -r src/css dist/css` works in place of `build-assets.js`, but it doesn't bundle `@import`s and doesn't minify — use it for a prototype, then switch to the esbuild flow for anything beyond that.

For a complete walkthrough of an integrated setup (with the full `clean.js`, `build-site.js`, and `build-assets.js` scripts), see [the hand-rolled app setup guide](./docs/app-setup-handrolled.md).

## Configuration

`swatchkit.config.js` at the project root. All options are optional.

```js
export default {
  // Pattern source directory (default: "./swatchkit")
  input: "./patterns",

  // Output directory (default: "./dist/swatchkit")
  outDir: "./dist/patterns",

  // CSS source directory.
  // `swatchkit init` defaults this to "./src/css".
  // No-config builds fall back to "./css".
  cssDir: "./src/css",

  // CSS files scanned for @swatchkit token blocks (supports a trailing * glob).
  // Default: ["<cssDir>/global/tokens.css", "<cssDir>/tokens.css", "<cssDir>/tokens/*.css"].
  // Add theme files explicitly when needed. See docs/tokens.md.
  tokenSources: ["./src/css/global/tokens.css", "./src/css/theme.css"],

  // Copy cssDir into outDir/css. Set false to reference CSS via cssPath
  // instead. See "Two ways to ship CSS" above.
  cssCopy: true,

  // Path from swatchkit's HTML to the CSS. Only used when cssCopy is false.
  // Default: "../<basename of cssDir>/"
  cssPath: "../css/",

  // Exclude files from the pattern library (supports globs).
  exclude: ["*.test.js"],

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
| `swatchkit init` | Create `swatchkit.config.js` **and** scaffold CSS blueprints, layout templates, and a starter `tokens.css`. Prompts for `cssDir`; pass `--cssDir` to skip the prompt. Status report if already initialized. |
| `swatchkit init --app` | Also scaffold an integrated esbuild app starter (build scripts, shared renderers, home page, two example swatches, watch-enabled `package.json`). |
| `swatchkit init --force` | Overwrite all managed files (with `.bak` backups). |
| `swatchkit init --dry-run` | Show what would change, write nothing. |
| `swatchkit` (default) | Build the pattern library. |

| Flag | Short | What it does |
| :--- | :--- | :--- |
| `--app` | | With `init`: scaffold the integrated esbuild app starter. |
| `--watch` | `-w` | Rebuild on file change. |
| `--config` | `-c` | Path to config file. |
| `--input` | `-i` | Pattern source dir (default: `swatchkit/`). |
| `--outDir` | `-o` | Output dir (default: `dist/swatchkit`). |
| `--cssDir` | | CSS dir for `init` (default prompt: `src/css`). |
| `--force` | `-f` | Overwrite config + blueprints (with backups). |
| `--dry-run` | | `init`: report without writing. |
| `--help` | `-h` | |
| `--version` | `-v` | |

## How it works

`swatchkit` (the build command) does four things:

1. **Parses `@swatchkit` token blocks** from the CSS files in `tokenSources` (your hand-written tokens — the source of truth). It regenerates `css/utilities/utilities.css` (utility classes derived from those tokens) and the token-documentation HTML under `swatchkit/tokens/`. Your token CSS is never modified — only `utilities.css` is generated. See [docs/tokens.md](./docs/tokens.md).
2. **Copies CSS** from `cssDir` to `outDir/css` (only when `cssCopy: true`).
3. **Scans `swatchkit/`** for swatches, renders each one. Static `index.html` swatches go through unchanged. Dynamic `index.js` swatches are imported and executed for their HTML. Sibling assets are copied alongside.
4. **Writes** `outDir/index.html` (the library) and one `outDir/preview/{section}/{id}/index.html` per swatch (full-screen previews).

In watch mode, SwatchKit compares generated content against existing files and **skips the write when nothing has changed** — so most rebuilds don't touch your CSS directory, and there's no infinite-rebuild loop when running alongside `onchange` or framework dev servers.

## What swatchkit owns vs what you own

| Path | Owned by | Notes |
| :--- | :--- | :--- |
| `src/css/global/tokens.css` | you | **Source of truth for design tokens.** Hand-edit freely (`@swatchkit` blocks). |
| `src/css/main.css` | you | Your entry point. |
| `src/css/global/variables.css` | you | Edit `var()` references if you rename tokens. |
| `src/css/global/elements.css` | you | Same. |
| `src/css/utilities/utilities.css` | swatchkit | Generated every build from your token blocks. Do not edit. |
| `src/css/swatchkit-ui.css` | you | Docs UI styling. Safe to customize. |
| `src/css/swatchkit-preview.css` | you | Preview page styling. Safe to customize. |
| `swatchkit/_swatchkit.html` | you | Layout template. `init --force` overwrites it. |
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

## Design tokens

SwatchKit is **CSS-first**: tokens live in plain CSS that you own and hand-edit.
You mark groups with `@swatchkit` comment blocks, and SwatchKit reads them to
document each group and to generate utility classes.

```css
/* src/css/global/tokens.css */
:root {
  /* @swatchkit colors "Brand Colors" */
  --brand: #3b49df;
  --brand-hover: oklch(from var(--brand) calc(l + 0.06) c h);
  /* @swatchkit end */
}
```

This documents a "Brand Colors" page and generates `.color:brand`,
`.background-color:brand`, etc. into `css/utilities/utilities.css`. Relational
values (`oklch(from …)`, `var(…)`, `clamp(…)`) are preserved verbatim in the
docs, so relationships are never flattened away.

Supported token types: `colors`, `spacing`, `text-sizes`, `text-weights`,
`text-leading`, `fonts`, `viewports`. Blocks can live under any selector (and
inside `@layer` / `@media`), so theme variants are documented by wrapping each
theme's region in its own block.

Fluid type and spacing use plain, universally-supported `clamp()` (no build-time
generator), tweakable via `--vw-min` / `--vw-max` / `--root-base` config variables.

See **[docs/tokens.md](./docs/tokens.md)** for the full reference: marker syntax,
`tokenSources`, every type's utilities, and the fluid `clamp()` pattern.

## Cascade layers

The scaffolded `main.css` declares a [cascade-layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) order so the cascade is predictable — a later layer always wins over an earlier one, regardless of selector specificity:

```css
@layer reset, tokens, elements, compositions, swatches, app, utilities;
```

| Layer | Contains |
| :--- | :--- |
| `reset` | browser reset |
| `tokens` | design tokens + variables |
| `elements` | bare element defaults |
| `compositions` | layout primitives (flow, cluster, sidebar, …) |
| `swatches` | your component styles |
| `app` | app/page-specific CSS (overrides components) |
| `utilities` | generated token utilities — the final word |

`utilities` is declared **last**, so utility classes win over component and app styles **without `!important`**. Add a utility class in your markup and it takes effect. Plain *unlayered* CSS still beats every layer — that's your escape hatch for the rare override.

## Acknowledgements

The CSS compositions included by default are adapted from [Every Layout](https://every-layout.dev/) by Heydon Pickering and Andy Bell.
