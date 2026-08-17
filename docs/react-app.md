# React App Setup

SwatchKit can scaffold a Vite React application and interactive React swatches.
The React app and pattern library use the same components and CSS.

Requires SwatchKit 6.3 or newer — earlier versions don't recognize `index.jsx`
and will skip React swatches.

## Quick Start

```bash
mkdir my-react-app && cd my-react-app
npm init -y
npx swatchkit init --app --react --cssDir ./src/css
npm install
npm run dev
```

Run `npm run dev` to start Vite and SwatchKit watch mode together. The React app
is served at `/` and the pattern library at `/swatchkit/`. Edit a component in
`src/components/` and both update.

`npm run build` produces:

```text
public/
└── swatchkit/               # SwatchKit output (generated; gitignored)

dist/
├── index.html
├── assets/                  # Vite JavaScript and CSS
└── swatchkit/               # copied from public/ by vite build
    ├── index.html
    ├── css/                 # SwatchKit's copy of src/css
    └── preview/
```

## How the two build tools share one server

SwatchKit writes the pattern library to `public/swatchkit` rather than straight
into `dist`. That one choice is what keeps the Vite config small:

- **In dev**, Vite serves `public/` at the site root, so `/swatchkit/` works
  without a custom static file server.
- **On build**, `vite build` copies `public/` into `dist/` as its final step,
  so `dist/swatchkit/` appears without a copy plugin.

SwatchKit therefore runs before Vite in both flows. `npm run build` is
`swatchkit && vite build`, and `npm run dev` generates the library once before
starting the parallel watch loop — Vite only mounts public-directory serving if
the directory exists when the dev server boots.

The generated `vite.config.js` adds one small plugin. Vite's public directory
serves files but does not resolve a directory URL to its `index.html`, and
SwatchKit links previews as directory URLs (`preview/swatches/button/`), so
those requests would otherwise fall through to the app shell.

## CSS

The app imports `src/css/main.css` through Vite, which bundles and hashes it
into `dist/assets/`. SwatchKit separately copies `src/css` into
`public/swatchkit/css/` so previews are self-contained static pages. Both read
the same source, and previews pick up an edit as soon as SwatchKit's watcher
rebuilds.

The tradeoff: previews load the CSS as authored, not as Vite processed it. For
plain CSS — which is what SwatchKit scaffolds, including `@import` and
`@layer` — the two are identical. If you add PostCSS plugins or Tailwind, the
previews will not see those transforms, and you'd want previews to point at
Vite's output instead (`cssCopy: false` with a `cssPath` into `dist/css`).

## React Swatches

A React swatch has an `index.jsx` server entry. It must default-export an HTML
string, just like a regular JavaScript swatch, but it can use React server
rendering to create that string:

```jsx
import { renderToString } from "react-dom/server";
import { ButtonGallery } from "../../../src/components/ButtonGallery.jsx";

export default `
  <h2>Buttons</h2>
  <div id="button-root">
    ${renderToString(<ButtonGallery />)}
  </div>
`;
```

For interactive behavior, add a `client.jsx` entry in the same directory:

```jsx
import { hydrateRoot } from "react-dom/client";
import { ButtonGallery } from "../../../src/components/ButtonGallery.jsx";

hydrateRoot(
  document.querySelector("#button-root"),
  <ButtonGallery />,
);
```

SwatchKit compiles `index.jsx` for Node, compiles `client.jsx` for the browser
as a minified production bundle, writes it as `client.js` beside the preview,
and adds the module script automatically. A single hydrated root per swatch is
the recommended default, even when that root contains many component examples.

If a component imports its own CSS (`import "./Button.css"`), that stylesheet is
emitted as `client.css` and linked into the preview alongside the script.

`renderToString()` is required for hydration. Use `renderToStaticMarkup()` only
when the preview does not need React state or event handlers. Event handlers are
not present in the server HTML; hydration attaches them from the browser bundle.

A swatch whose `index.jsx` or `client.jsx` fails to compile is reported and
skipped — the rest of the library still builds.
