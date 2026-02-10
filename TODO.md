# SwatchKit To-Do

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
  - remove the source of truth for tokens being the json file?
  - the json files are still the source of truth for displaying the tokens in the ui. so maybe the json is the best strat.

## Additions

- whats this doing in the dist/swatchkit folder:

  /140/󰉋 /css
  /141/󰉋 /js
  /142/󰉋 /preview
  /143/󰌝 /index.html

- consider handling variants on their own/ with their own full screen viewer
- should we wire up an example swatch?
- background of examples checkerboard like design.visa.com's examples
- fix full screen preview padding/margin
- grid composition following lesson 2-6 in complete css.
- composition examples for:
  - grid
  - indent
  - region
  - visually-hidden
- consider moving prose section to compositions section or someplace else.
- consider adding the token json file content to the config file?
- consider using a prefix field in the json files to allow keys like "min" that when coupled with prefix: "viewport-", will turn into "viewport-min". this might make swatchkit-ui display more concise. "min" instead of "viewport-min". this could have variable or utility class name impact as well. line-height:fine vs line-height:leading-fine
- progressively enhance native select component in global-styles
- what else can be progressively enhanced? checkboxes?

## UI

- fix the .html in <http://127.0.0.1:8080/swatchkit/preview/swatches/card.html> that happens
- home page for the padding lib
- use a table for text/spacing so we can see min/max values. also utility token. also consider generating spacing utilities. gutter. flow-space.
- View full page links styling. and location.
- need a scroll to top button
- print media queries just for fun
