# SwatchKit Preview View Transitions Proposal

## Goal

Add a small, SwatchKit-owned enhancement that uses cross-document View Transitions to morph a swatch preview iframe from the main SwatchKit UI into its full-screen preview page, and back again.

The feature should be scoped to SwatchKit's UI and preview pages. It should not require projects to predeclare `view-transition-name` values for every swatch iframe or preview page in their application CSS.

## Intended Behavior

- On the main SwatchKit page, each swatch is rendered in an iframe.
- When a user opens a full-screen preview page, the matching iframe temporarily receives `view-transition-name: preview`.
- On the destination preview page, the preview body has `view-transition-name: preview`.
- The browser pairs those two elements during cross-document navigation.
- When returning from a preview page to the main SwatchKit page, the destination iframe is temporarily tagged the same way so the transition can reverse.
- Browsers without cross-document View Transitions should continue to navigate normally.

## Proposed Scope

- Add a dedicated SwatchKit JS file, for example `swatchkit-nav.js`.
- Load that script from both the SwatchKit main layout and the preview layout.
- Add View Transition CSS only to `swatchkit-ui.css` and `swatchkit-preview.css`.
- Add build/scaffold support so the script is available wherever the generated HTML references it.
- Add smoke tests for generated script paths and asset output.

## Non-Goals

- Do not add a large generated `src/css/**` tree to the package source.
- Do not couple this feature to an application-level `main.js` bundle.
- Do not require users to manually add `view-transition-name` for every swatch.
- Do not redesign SwatchKit's UI beyond the minimum CSS needed for transitions.

## Prototype JavaScript

This is the current prototype from `swatchkit-nav.js`. A clean reimplementation should keep the same idea, but fix known edge cases such as root-level preview URLs and selector escaping.

```js
// SwatchKit navigation script
//
// Powers the View Transitions API cross-page morph between the SwatchKit
// main UI page and a swatch's full-screen preview page.
//
// During pageswap (main -> preview): the iframe carrying the swatch is
// tagged with view-transition-name: "preview" so the browser morphs the
// iframe content into the preview page body.
//
// During pagereveal (preview -> main): the same name is set on the
// destination iframe so the reverse morph pairs up.

function parsePreviewTarget(url) {
  const match = url.pathname.match(/\/preview\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return { isPreview: false, slug: null };
  return { isPreview: true, slug: match[2] };
}

window.addEventListener("pageswap", (e) => {
  if (!e.viewTransition) return;
  const targetUrl = new URL(e.activation.entry.url);
  const { isPreview, slug } = parsePreviewTarget(targetUrl);
  if (!isPreview) return;

  const iframe = document.querySelector(`#${slug} iframe`);
  if (!iframe) return;

  iframe.style.viewTransitionName = "preview";
  e.viewTransition.finished.then(() => {
    iframe.style.viewTransitionName = "none";
  });
});

window.addEventListener("pagereveal", async (event) => {
  if (!event.viewTransition) return;
  const fromUrl = event.activation?.from?.url
    ? new URL(event.activation.from.url)
    : null;
  if (!fromUrl) return;

  const { isPreview, slug } = parsePreviewTarget(fromUrl);
  if (!isPreview) return;

  const iframe = document.querySelector(`#${slug} iframe`);
  if (!iframe) return;

  iframe.style.viewTransitionName = "preview";
  await event.viewTransition.ready;
  iframe.style.viewTransitionName = "none";
});
```

## Prototype CSS

### `swatchkit-ui.css`

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

### `swatchkit-preview.css`

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

## Clean Reimplementation Notes

- Support both preview URL shapes: `preview/{slug}/` and `preview/{section}/{slug}/`.
- Use `document.getElementById(slug)?.querySelector("iframe")` instead of interpolating the slug into a CSS selector.
- Ensure the JS file exists in every generated build that references it, including `init --app` builds.
- Avoid committing scaffolded/generated project output as package source.
- Consider watching `jsDir` in `--watch` mode so changes to the SwatchKit nav script are copied during development.

## Suggested Tests

- Fresh `swatchkit init` build includes `dist/swatchkit/js/swatchkit-nav.js`.
- Main `dist/swatchkit/index.html` references the script at the correct path.
- Preview pages reference the script with the correct depth-aware relative path.
- `init --app` produces or copies the script wherever `jsPath` points.
- Root-level swatches and section-level swatches both map to the correct iframe.
- Slugs with selector-significant characters do not throw during lookup.
