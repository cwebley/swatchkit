# SwatchKit To-Do

## Token Strategy — DONE in v5

- ~~**Format Evaluation:** Are the JSON files useful for designers/Figma?~~
  Resolved: v5 dropped JSON entirely. Tokens are now CSS-first (`@swatchkit`
  blocks in `tokens.css`); CSS is the single source of truth and also drives the
  docs UI (parsed with PostCSS).
- ~~**Config-First Architecture:** `JSON -> CSS`.~~ Superseded — there is no
  JSON layer anymore; you author CSS directly.
- ~~**CSS-Native Clamping:** remove the JS clamp generator.~~ Done: fluid type
  and spacing use hand-written `clamp()` (unitless `--vw-min`/`--vw-max`/
  `--root-base` pattern), no JS generator, no rebuild to retune.

## Architecture

### Generate token docs into `dist`, not back into the source tree (future)

Today the build generates token-documentation HTML into the **source**
`swatchkit/tokens/*.html`, then scans `swatchkit/**/*.html` as normal swatches.
This round-trip (write generated files into source, then scan source) is the
root of a class of bugs.

In 5.1.2 we fixed the most painful symptom — stale generated docs from
removed/renamed `@swatchkit` blocks — with marker-based cleanup: each generated
file carries `<!-- @swatchkit generated-token-doc -->`, and the build removes
marked files that are no longer wanted (leaving hand-authored files alone).

The cleaner long-term design is **Option 3: generate token docs directly into
`dist/swatchkit/preview/tokens/` (and inject them into the sidebar/sections
model in memory), instead of writing them into the source `swatchkit/tokens/`
directory at all.**

Benefits:
- Generated output never pollutes the source tree (no marker hack needed, no
  stale files, nothing to `.gitignore`).
- "Generated vs. authored" is unambiguous: source = yours, dist = ours.
- Removes the write-into-source-then-scan-source coupling.

Why it's deferred (it's a bigger change than the marker fix):
- The scanner currently treats `swatchkit/tokens/*.html` like normal source
  swatches; section + sidebar generation is driven by the scanned `sections`
  structure.
- Preview-page generation also derives from that scanned structure.
- To move generation into `dist`, token docs would need to be inserted into the
  `sections` map directly (a synthetic "Design Tokens" section) rather than
  discovered by scanning — touching the scan/section/preview pipeline.
- Need to decide how a user could still *hand-author* token pages under
  `swatchkit/tokens/` if they want to (probably: still scan that dir for
  authored files, just stop writing generated ones into it).

When tackled, drop the `GENERATED_TOKEN_DOC_MARKER` machinery in
`src/generators/index.js` and the cleanup step in `build.js`.

## Additions

- grid composition following lesson 2-6 in complete css.
- i dont really like variables like --cluster-horizontal-alignment and --cluster-vertical-alignment.
  - seems like --cluster-justify-content would be better. then i at least know the possible values.
  - keep track of more of these to potentially make improvements.
  - cluster and repel seem suuuuper similar. but i suppose repel is common enough its fine.
- progressively enhance native select component in global-styles
- what else can be progressively enhanced? checkboxes?
- <https://www.youtube.com/watch?v=5uhIiI9Ld5M&t=19m40s> do we need to support a different ratio for max viewports vs min for clamp calculation!?

- ::search-text && ::search-text:current! add to elements.css for chrome additions. nice progressive enhacement

## UI

- scroll to top button
