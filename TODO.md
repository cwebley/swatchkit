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
