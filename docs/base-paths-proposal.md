# SwatchKit Base Paths Proposal

## Goal

Simplify how SwatchKit generated pages reference shared assets and preview pages.

Today, nested preview pages carry depth-specific paths such as `../../` and
`../../../` directly in every `href` and `src`. This is difficult to read,
spreads path logic across templates, config, and build code, and makes hosted
environments such as Plasma do extra work to infer what SwatchKit meant.

The proposed fix is separate from the View Transitions work. View Transitions
can use the result of this path cleanup later, but the base-path change should
be scoped, implemented, and tested as its own feature.

## Current Behavior

SwatchKit generates multiple HTML pages at different depths:

- Main UI: `dist/swatchkit/index.html`
- Root preview: `dist/swatchkit/preview/{slug}/index.html`
- Section preview: `dist/swatchkit/preview/{section}/{slug}/index.html`

Because those files live at different depths, the build currently prefixes CSS
paths manually:

- Main UI: `css/main.css`
- Root preview: `../../css/main.css`
- Section preview: `../../../css/main.css`

The same depth logic would also be needed for any SwatchKit-owned JavaScript
asset, which would add more repeated path computation if left unchanged.

## Problems

- The output is noisy and hard to read.
- The path depth logic is encoded in generated HTML instead of one central place.
- New assets, such as a future `swatchkit.js`, would duplicate the same depth logic.
- Hosted environments need to preserve or reconstruct SwatchKit's intended root.
- Plasma currently has to rewrite or clamp parent-relative URLs such as `../` paths
  back into its uploaded dist route.

## Proposed Approach

Use a per-page `<base href>` for self-contained SwatchKit builds and make asset
links base-relative.

Instead of repeating the depth prefix in every asset URL, each page declares its
root once:

```html
<base href="../../../" />
<link rel="stylesheet" href="css/main.css" />
<link rel="stylesheet" href="css/swatchkit-preview.css" />
<script src="js/swatchkit.js"></script>
```

For the main SwatchKit page, the base is the current directory:

```html
<base href="./" />
<link rel="stylesheet" href="css/main.css" />
<link rel="stylesheet" href="css/swatchkit-ui.css" />
<a href="preview/button/">View full screen</a>
```

The generated links become easier to read, and the only depth-specific value is
the page's `base` element.

## Scope

This should apply to self-contained builds where `cssCopy: true`.

In that mode, the SwatchKit output owns a complete static tree under
`dist/swatchkit/`, so a base rooted at that directory can describe every shared
asset and preview link.

For integrated builds where `cssCopy: false`, keep the existing external CSS
path behavior. In that mode, CSS commonly lives outside the SwatchKit output,
such as `dist/css/`, and a SwatchKit-root `<base>` cannot describe that external
relationship cleanly. The implementation should still centralize relative-path
computation for this mode, but it should not force the `<base>` model there.

## Implementation Plan

1. Add a central helper for computing the root-relative prefix for a generated
   page from the page file location to `settings.outDir`.
2. Replace hardcoded preview prefixes such as `../../` and `../../../` with the
   helper.
3. Add a `<!-- BASE_HREF -->` placeholder to SwatchKit's main and preview layout
   templates.
4. For `cssCopy: true`, emit `<base href="..." />` and use clean base-relative
   asset paths such as `css/main.css`, `css/swatchkit-ui.css`,
   `css/swatchkit-preview.css`, and future `js/swatchkit.js`.
5. For `cssCopy: false`, omit the generated `<base>` and keep computed relative
   paths to the configured external CSS location.
6. Add an optional absolute `basePath` configuration value for environments with
   a known fixed mount point. If provided, use that value instead of a computed
   relative base in self-contained builds.
7. Update smoke tests to cover main pages, root previews, section previews,
   `cssCopy: true`, `cssCopy: false`, and optional `basePath`.

## Fragment Link Concern

The main SwatchKit page uses hash links in the sidebar, such as `href="#button"`.
Preview content can also contain placeholder links such as `href="#"`.

A `<base>` element changes how the browser resolves fragment-only links. For
example, with `<base href="../../../" />`, `href="#"` resolves against the base
URL, not necessarily the current document URL. That can cause unexpected
navigation instead of same-page scrolling or no-op behavior.

If SwatchKit emits `<base>` on pages that contain fragment links, it should also
ship a small client-side fragment handler. That handler should:

- Intercept local `#...` links before the browser resolves them through `<base>`.
- Treat `href="#"` as a no-op or scroll-to-top without leaving the current page.
- Scroll to matching in-page targets for `href="#some-id"`.
- Update history/hash in a way that does not trigger cross-document navigation.

This can live in the `swatchkit.js` client script. The script also owns View
Transitions behavior, but the fragment shim is a base-path concern and should be
planned with this change rather than the View Transitions change.

## Relationship To View Transitions

This base-path work should be independent from the View Transitions feature.

The View Transitions feature adds a SwatchKit client script at `swatchkit.js`.
When the base-path change lands, that script can use the same clean
base-relative URL model:

```html
<script src="js/swatchkit.js"></script>
```

Without this cleanup, the script path would need the same depth-specific prefixes
as CSS, such as `../../js/swatchkit.js` and `../../../js/swatchkit.js`.

## Plasma Notes

Plasma serves uploaded static builds from dynamic routes such as:

```text
/v1/pattern-versions/{id}/dist/...
```

This creates multiple possible roots:

- The uploaded static app root, such as `dist/`
- Plasma's dist API route
- The API domain root

When SwatchKit output contains relative links without an explicit base, Plasma
has to infer how those links should resolve. This is especially fragile for
nested preview pages and for links such as `preview/{section}/{slug}/` opened
from the main SwatchKit UI.

If SwatchKit emits clean base-relative URLs plus one `<base>` per page, Plasma's
rewrite job can be simpler:

- Replace SwatchKit's relative `<base>` with Plasma's absolute dist route base.
- Avoid rewriting or clamping many individual `../` `href` and `src` values.
- Keep existing handling for non-SwatchKit SPA/Vite uploads that produce absolute
  `/assets/...` paths or other framework-specific URLs.

Important detail: if Plasma injects a base tag, it should replace any existing
`<base>` tag rather than append another one. Browsers honor the first `<base>`
element, so adding a second base after SwatchKit's base may not work.

Plasma may still need its SPA router fix for application uploads. SwatchKit
cannot solve that from its generated output because Plasma's route is dynamic and
known only at serve time. Longer term, Plasma could detect static multi-page
uploads, such as SwatchKit builds with `preview/**/index.html`, and serve them as
plain static files without SPA router rewriting.

## Plasma Follow-Up Draft

After SwatchKit emits base-relative output, a Plasma follow-up could:

1. Update base injection to replace an existing `<base>` tag when present.
2. Keep the injected base absolute, for example
   `/v1/pattern-versions/{id}/dist/swatchkit/` for `swatchkit/index.html`.
3. Remove parent-relative `../` clamping for SwatchKit output once generated
   SwatchKit HTML no longer contains those URLs.
4. Keep absolute path and `url()` rewrites for other static app uploads.
5. Add tests using SwatchKit-like fixtures with `<base href="./" />`,
   `<base href="../../" />`, and `<base href="../../../" />`.
6. Consider a later static-multipage detection mode that skips SPA router fixes
   entirely for SwatchKit-style uploads.

## Open Questions

- Should `basePath` be added in the first implementation, or should the first
  pass support only computed relative bases?
- Should the fragment-link shim ship with the base-path change, or as a follow-up
  change to `swatchkit.js`?
- For `href="#"`, should SwatchKit's fragment handler no-op, scroll to top, or
  preserve browser default when no `<base>` is present?
- Should custom layout authors be required to add `<!-- BASE_HREF -->`, or should
  the build inject the base through the existing `<!-- HEAD_EXTRAS -->` placeholder
  for easier upgrades?
- Should Plasma detect SwatchKit output explicitly, or should it rely only on
  general static HTML behavior such as existing `<base>` tags?
