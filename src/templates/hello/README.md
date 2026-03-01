# Hello Swatch

This is your first swatch. It lives at `swatchkit/swatches/hello/`.

## How swatch folders work

SwatchKit treats every folder inside `swatchkit/` that contains an `index.html`
as a swatch. The `index.html` is rendered inside a preview iframe in the pattern
library. It is an HTML fragment — no `<html>`, `<head>`, or `<body>` needed, since
SwatchKit wraps it in a full page automatically.

## Sibling files are copied alongside

Every file in this folder **other than** `index.html` and `description.html` is
copied into the build output next to the preview page. That means your `index.html`
can reference sibling files using relative paths:

```html
<link rel="stylesheet" href="./styles.css">
<script src="./script.js"></script>
<img src="./demo-image.png" alt="">
```

This makes each swatch self-contained. Drop in whatever assets the demo needs.

## description.html

If you add a `description.html` file to this folder, its contents will be
displayed above the iframe in the pattern library UI — useful for documenting
usage notes, props, or design decisions.

## Global CSS

Component styles that belong in your real app's stylesheet (not just the demo)
live in `css/swatches/`. The `hello.css` file there is imported into `main.css`
via `css/swatches/index.css`. Add new component CSS files to that folder and
import them from `css/swatches/index.css`.

## Opting out with underscores

Prefix any file or folder with `_` to exclude it from the build entirely —
it won't be rendered as a swatch and won't be copied to the output.

This works at every level:

- `swatchkit/swatches/_wip/` — entire swatch folder ignored
- `swatchkit/_drafts/` — entire section folder ignored
- `swatchkit/swatches/hello/_notes.md` — single file inside a swatch, not copied
- `swatchkit/swatches/hello/_fixtures/` — subdirectory inside a swatch, not copied

This is useful for work-in-progress components, private notes, test fixtures,
or any file that should live alongside a swatch but never appear in the output.

## A note on CSS isolation

SwatchKit does not scope or isolate CSS between swatches. Every preview page
loads the same global stylesheet (`main.css` and everything it imports), so
styles defined in `css/swatches/hello.css` are active on *every* swatch's
preview page — not just this one.

This means `button { background: red }` in one swatch's CSS will affect the
`<button>` elements in every other swatch. If two swatches both style `button`
differently, the cascade determines which wins.

The fix is to scope your styles with a component-specific class:

```css
/* Instead of this: */
button { background: red; }

/* Do this: */
.hello-swatch button { background: red; }
```

The same applies to sibling CSS files (`./styles.css` next to `index.html`) —
they load per-page on top of the global stylesheet, so unscoped rules will
still bleed into any swatch that shares the same elements.

## This README

This file (`README.md`) is ignored by SwatchKit's UI — it is just for you and
your team. It gets copied into the build output alongside `index.html`, but it
is not rendered anywhere in the pattern library.
