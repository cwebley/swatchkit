# View Transitions Upgrade

SwatchKit can progressively enhance navigation from the main SwatchKit UI to a
full-screen swatch preview with cross-document View Transitions.

New projects created with `swatchkit init` include the required CSS, layout
placeholder, and user-editable client script. Existing projects can opt in by
adding the same files and template changes manually, or by re-running
`swatchkit init --force` and reviewing the backed-up files.

## What The Feature Adds

- `swatchkit/swatchkit.js`, a user-editable SwatchKit client script.
- A generated copy at `dist/swatchkit/js/swatchkit.js`.
- A conditional script tag in the main SwatchKit UI and preview pages.
- View Transition CSS in `swatchkit-ui.css` and `swatchkit-preview.css`.

Browsers without cross-document View Transitions ignore the enhancement and keep
normal navigation behavior.

## Manual Upgrade Steps

### 1. Add `swatchkit/swatchkit.js`

Copy the current blueprint from `src/blueprints/swatchkit.js` into your project:

```text
swatchkit/swatchkit.js
```

This file is intentionally project-owned. Edit it if you want to tune the
transition behavior or add more SwatchKit-specific client-side enhancements.

### 2. Update SwatchKit Layout Templates

In `swatchkit/_swatchkit.html`, add the script placeholder in the document
`<head>`:

```html
<!-- SWATCHKIT_SCRIPT -->
```

In `swatchkit/_preview.html`, add the same placeholder in the document `<head>`:

```html
<!-- SWATCHKIT_SCRIPT -->
```

The build replaces this placeholder with a depth-aware script tag only
when `swatchkit/swatchkit.js` exists. If the file is missing, the placeholder is
removed and no script tag is emitted.

### 3. Update `swatchkit-ui.css`

Add the View Transition rules to the SwatchKit UI stylesheet:

```css
@view-transition {
  navigation: auto;
}

::view-transition-old(preview) {
  display: none;
}

::view-transition-new(preview) {
  animation: none;
}
```

### 4. Update `swatchkit-preview.css`

Add the same View Transition rules and tag the preview body:

```css
@view-transition {
  navigation: auto;
}

::view-transition-old(preview) {
  display: none;
}

::view-transition-new(preview) {
  animation: none;
}

body {
  view-transition-name: preview;
}
```

Keep any existing preview body styles in place; add `view-transition-name` to the
existing `body` rule if you already have one.

## Notes

- The script is intentionally loaded as a classic head script rather than a
  module so the `pagereveal` listener is registered early enough for reverse
  preview-to-index transitions.
- The script path is internal to the SwatchKit output and does not depend on
  `cssCopy`. The main UI references `js/swatchkit.js`; preview pages reference
  the same file with the correct relative depth.
- The feature does not require app code to add `view-transition-name` values.
- The script uses `document.getElementById(slug)?.querySelector("iframe")`, so it
  expects the default SwatchKit shape where each swatch section has an `id` equal
  to the swatch slug and contains the preview iframe.
- The base-path and `<base href>` cleanup is tracked separately in
  `docs/base-paths-proposal.md`.
