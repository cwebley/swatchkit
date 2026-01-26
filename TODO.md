# SwatchKit To-Do

## Swatches & Layout
- [x] **Dynamic Sections:** Refactored `build.js` to support arbitrary folder organization.
- [x] **Renaming:** Updated terminology from "Patterns" to "Swatches".
- [x] **Compositions:** Implemented default compositions (Flow, Sidebar) in `css/compositions/`.

## Token Strategy
- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements
- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
- [x] Add .npmignore
- [x] Add a CSS reset (Andy Bell's modern reset).
- Consider handling utility class helpers. 'text-align:\ center'.
