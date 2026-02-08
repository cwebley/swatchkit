# SwatchKit To-Do

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
  - remove the source of truth for tokens being the json file?
  - the json files are still the source of truth for displaying the tokens in the ui. so maybe the json is the best strat.

- Consider handling utility class helpers. 'text-align:\ center'.

## Additions

- add text-wrap pretty in reset to all <p></p>
- grid composition following lesson 2-6 in complete css.
- prose composition for margin botton after sections?
- indent
- region
- visually-hidden
- consider moving prose token example to a different category. also rename it if we're using .prose as a utility.
- consider adding the token json file content to the config file?
- consider using a prefix field in the json files to allow keys like "min" that when coupled with prefix: "viewport-", will turn into "viewport-min". this might make swatchkit-ui display more concise. "min" instead of "viewport-min"
- progressively enhance native select component in global-styles

## UI

- View full page links styling. and location.
- need a scroll to top button
