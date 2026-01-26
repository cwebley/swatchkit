# SwatchKit To-Do

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.

- Add .npmignore

- Consider adding a css reset.

- Consider handling utility class helpers. 'text-align:\ center'.
  - a way to quickly add these? or a way to read the html and generate these as needed?
