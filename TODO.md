# SwatchKit To-Do

## Swatches & Layout

- [x] **Compositions:** Implemented default compositions (Flow, Sidebar) in `css/compositions/`.

## Token Strategy

- **Format Evaluation:** Are the JSON files useful for designers/Figma? Should they be? Consider removing unused viewports in default setup.
- **Config-First Architecture:** Evaluate moving from `JSON -> CSS` to `Config -> CSS` directly (creating JSON on demand if needed).

## Technical Improvements

- **CSS-Native Clamping:** Evaluate removing JS clamp generator logic and handling it entirely in CSS `clamp()`.
  - _Benefit:_ Easier updates; changing a single CSS variable cascades instantly without a rebuild/watcher.
- Consider handling utility class helpers. 'text-align:\ center'.

## Additions

- grid composition following lesson 2-6 in complete css.
- consider naming of styles.css to global.css
- add a global css prose kitchen sink part: like <http://192.168.1.72:8081/pattern-library/pattern/prose/>. uhh definitely.
  <https://bloom-barista.academy/pattern-library/pattern-preview/prose/>
