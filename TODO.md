# SwatchKit To-Do

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
- Consider handling utility class helpers. 'text-align:\ center'.

## Additions

- grid composition following lesson 2-6 in complete css.
- prose composition for margin botton after sections?
- indent
- region
- visually-hidden
- consider moving prose token example to a different category. also rename it if we're using .prose as a utility.
- consider separating main.css into variables.css and global-styles.css like the pattern library.
- consider adding the token json file content to the config file?
- consider using a prefix field in the json files to allow keys like "min" that when coupled with prefix: "viewport-", will turn into "viewport-min". this might make swatchkit-ui display more concise. "min" instead of "viewport-min"

## UI

- View full page links styling.
