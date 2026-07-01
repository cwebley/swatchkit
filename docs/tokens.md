# Design Tokens (v6)

SwatchKit is **CSS-first**: your design tokens live in plain CSS that you own
and hand-edit. SwatchKit never generates token CSS from a separate format — it
*reads* your CSS to document tokens and to generate utility classes.

You mark groups of tokens with `@swatchkit` comment blocks. SwatchKit parses
those blocks (with PostCSS) and, for each one:

1. renders a rich documentation page in the pattern library, and
2. generates matching utility classes into `css/utilities/utilities.css`.

The only file SwatchKit writes is `utilities/utilities.css`. Your token CSS is
yours.

---

## Marker syntax

```css
:root {
  /* @swatchkit colors "Brand Colors" */
  --brand: #3b49df;
  --brand-ink: #1a1a2e;
  /* @swatchkit end */
}
```

- Open marker: `/* @swatchkit <type> "<Display Label>" */`
  - `<type>` must be one of the known types (below).
  - `<Display Label>` is the title shown on the docs page (any text, in quotes).
- Close marker: `/* @swatchkit end */`
- **Both markers are required.** An unclosed block, an unknown type, or a
  malformed marker fails the build with a clear message.
- Only custom properties (`--name: value;`) inside the block are treated as
  tokens. Anything else in the block is ignored.

### Where blocks can live

Blocks may appear under **any selector**, and inside `@layer`, `@media`, or CSS
nesting. This is how you document theme variants — wrap each theme's region in
its own block:

```css
:root {
  /* @swatchkit colors "Light Palette" */
  --surface: oklch(0.98 0.01 250);
  /* @swatchkit end */
}

[data-theme="dark"] {
  /* @swatchkit colors "Dark Palette" */
  --surface: oklch(0.2 0.02 250);
  /* @swatchkit end */
}
```

Each block becomes its own documentation page ("Light Palette", "Dark Palette").
The real CSS cascade still decides which value actually applies at runtime;
SwatchKit just documents each group.

### Values are captured verbatim

Token values are shown exactly as authored — relationships are preserved:

```css
--brand-hover: oklch(from var(--brand) calc(l + 0.06) c h);
```

The docs show `oklch(from var(--brand) calc(l + 0.06) c h)`, not a flattened
color. (A live color chip is rendered from the authored value, so a "Dark
Palette" page shows dark colors even on a light page.)

---

## Which files are scanned: `tokenSources`

SwatchKit only parses the files listed in `tokenSources` (config). Default:

```js
// swatchkit.config.js
export default {
  // ...
  tokenSources: [
    "./src/css/global/tokens.css",
    "./src/css/tokens.css",
    "./src/css/tokens/*.css",
  ],
};
```

(`<cssDir>` substitutes for `./src/css` above based on your `cssDir`.) A single
trailing `*` glob on the filename is supported. Add theme files explicitly:

```js
tokenSources: ["./src/css/global/tokens.css", "./src/css/nova-theme.css"],
```

SwatchKit never auto-scans `node_modules` or your whole CSS tree — so importing
a large vendor stylesheet never slows the token parse.

---

## Token types

| Type | What it documents | Utility classes generated |
| :--- | :--- | :--- |
| `colors` | Color values (incl. relational `oklch(from …)`) | `.color:<name>`, `.background-color:<name>` |
| `spacing` | Spacing scale (static or fluid `clamp()`) | `.margin-*:<name>`, `.padding-*:<name>` (12 logical props), `.gap:<name>`, `.flow-space:<name>`, `.region-space:<name>`, `.gutter:<name>` |
| `text-sizes` | Type scale | `.font-size:<name>` |
| `text-weights` | Font weights | `.font-weight:<name>` |
| `text-leading` | Line-heights | `.line-height:<name>` |
| `fonts` | Font stacks | `.font-family:<name>` |
| `viewports` | Breakpoint values | *(none — documentation only)* |

The utility class suffix is the **full custom-property name** (minus the leading
`--`). So `--palette-default-active` becomes `.color:palette-default-active`.
Utilities reference `var(--name)`, so they theme correctly at runtime. Identical
rules produced by multiple variant blocks are deduplicated.

Utility controls are block-level emission controls, not global token-name deny
lists. If one disabled block and one enabled block both contain `--step-0`, the
`.font-size:step-0` rule still generates from the enabled block.

Utilities **do not use `!important`**. Instead, `main.css` imports the generated
`utilities.css` into a `utilities` cascade layer that is declared **last**, so a
utility class wins over component and app styles by layer order — not specificity
or `!important`. Add a utility class in your markup and it takes effect. (Plain
*unlayered* CSS still overrides every layer, which is your escape hatch.)

---

## Controlling generated outputs: `tokenBlocks`

Use `tokenBlocks` in `swatchkit.config.js` when you want to control generated
documentation and utility classes without removing `@swatchkit` markers from
your CSS. CSS token blocks define token groups; config controls generated
outputs.

Output defaults are:

- `docs: true`
- `utilities: true` when the token type has utility classes
- `utilities: false` for `viewports`

```js
// swatchkit.config.js
export default {
  tokenBlocks: {
    textSizes: {
      docs: {
        excludeLabels: ["Steps"],
      },
      utilities: {
        excludeLabels: ["Typography"],
      },
      labels: {
        Steps: { docs: false, utilities: true },
        Typography: { docs: true, utilities: false },
      },
    },
  },
};
```

`includeLabels` and `excludeLabels` accept a string or an array of strings. If
both are set, `includeLabels` is applied first and `excludeLabels` removes from
that included set. Exact label entries in `labels` win over broad filters.

Supported `tokenBlocks` type keys are `colors`, `spacing`, `textSizes`,
`textWeights`, `textLeading`, `fonts`, and `viewports`. Canonical CSS marker keys
such as `"text-sizes"` also work, but do not configure both an alias and its
canonical key in the same config.

When utilities are disabled for a docs page, the generated docs omit utility
class examples for that page.

---

## Customizing generated token docs: `tokenDocs`

Use `tokenDocs` only for documentation presentation. In v6 it no longer controls
whether docs are generated; use `tokenBlocks` for output visibility.

```js
// swatchkit.config.js
export default {
  tokenDocs: {
    // Generated token docs hide their View source details by default.
    // Set true if you want source shown for generated token docs.
    showSource: false,

    colors: {
      // Pick and reorder color table columns.
      columns: ["name", "value", "customProperty"],
      columnLabels: {
        customProperty: "CSS variable",
      },
    },
  },
};
```

Supported color columns:

| Column | Default label | Renders |
| :--- | :--- | :--- |
| `name` | Name | Color chip plus token name without the leading `--` |
| `value` | Value | The authored token value |
| `customProperty` | Custom Property | `var(--token-name)` |
| `colorUtility` | Color Utility Class | `.color:<name>` |
| `backgroundUtility` | BG Utility Class | `.background-color:<name>` |

If utilities are disabled through `tokenBlocks`, utility columns are automatically
omitted from color docs even if they are listed in `tokenDocs.colors.columns`.

`tokenDocs.enabled`, `tokenDocs.includeLabels`, and `tokenDocs.excludeLabels`
were removed in v6. Use `tokenBlocks` instead.

---

## Fluid values with `clamp()`

v6 has no build-time clamp generator — fluid type and spacing are written as
plain, universally-supported `clamp()`. To keep them tweakable, store the
viewport bounds and rem base as **unitless** config variables and apply units at
the leaves:

```css
:root {
  /* Fluid config — tweak these; clamps recompute live, no rebuild. */
  --vw-min: 330;   /* min viewport (unitless px) */
  --vw-max: 1350;  /* max viewport (unitless px) */
  --root-base: 16; /* px base the min/max numbers are authored in (16 = 1rem) */

  /* @swatchkit text-sizes "Text Sizes" */
  /* 15px at 330px viewport → 18px at 1350px viewport */
  --step-0: clamp(
    calc(15 / var(--root-base) * 1rem),
    calc(
      (15 - var(--vw-min) * (18 - 15) / (var(--vw-max) - var(--vw-min)))
        / var(--root-base) * 1rem
      + (18 - 15) / (var(--vw-max) - var(--vw-min)) * 100vw
    ),
    calc(18 / var(--root-base) * 1rem)
  );
  /* @swatchkit end */
}
```

Why unitless? CSS `calc()` can divide by a unitless number (`/ 1020`) but not by
a unitful one (`/ 1020px`). Keeping the bounds unitless and multiplying by
`1rem` / `100vw` at the end keeps the math valid.

`--root-base` is the px base your min/max numbers are written in — it is **not** an
assumption about the user's browser font size. The `clamp()` floors and ceilings
resolve to `rem`, so they still scale up if the user increases their default font
size (CSS has no way to read the live root px as a number, which is why this base
is declared explicitly). Only change it if you author the min/max values in a
different px base.

The `swatchkit init` blueprint ships a full fluid type and spacing scale already
written this way — copy a line and change the two numbers (min, max) to add a
step. Adjust `--vw-min` / `--vw-max` to retune every fluid token at once.

> **Future:** when the CSS `@function` rule reaches cross-browser support, these
> can collapse to `--step-0: --fluid(15, 18);` with no change to consumers.
> Until then, the explicit `clamp()` works everywhere today.

---

## What SwatchKit owns vs. what you own

| Path | Owner | Notes |
| :--- | :--- | :--- |
| `css/global/tokens.css` | **you** | Source of truth. Hand-edit freely. |
| `css/utilities/utilities.css` | swatchkit | Generated every build. Do not edit. |
| `swatchkit/tokens/*.html` | swatchkit | One generated doc page per `@swatchkit` block. Do not edit. |
| any file in `tokenSources` | **you** | Your CSS; SwatchKit only reads it. |

### Generated token doc pages

SwatchKit writes one documentation page per `@swatchkit` block into
`swatchkit/tokens/*.html`. Each generated file starts with the marker comment
`<!-- @swatchkit generated-token-doc -->`. When you remove or rename a block,
the build deletes the stale generated page on the next run (it only removes
files carrying that marker, so any pages you hand-author in `swatchkit/tokens/`
are left untouched).
