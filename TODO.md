# SwatchKit To-Do

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
  - remove the source of truth for tokens being the json file?
  - the json files are still the source of truth for displaying the tokens in the ui. so maybe the json is the best strat. ## Additions

- should we wire up an example swatch?
- grid composition following lesson 2-6 in complete css.
  - indent
  - region
  - visually-hidden
- i dont really like variables like --cluster-horizontal-alignment and --cluster-vertical-alignment.
  - seems like --cluster-justify-content would be better. then i at least know the possible values.
  - keep track of more of these to potentially make improvements.
  - cluster and repel seem suuuuper similar. but i suppose repel is common enough its fine.
- progressively enhance native select component in global-styles
- what else can be progressively enhanced? checkboxes?
- <https://www.youtube.com/watch?v=5uhIiI9Ld5M&t=19m40s> do we need to support a different ratio for max viewports vs min for clamp calculation!?

## UI

- scroll to top button
