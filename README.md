# SwatchKit

**SwatchKit** is a lightweight, zero-configuration tool for creating HTML pattern libraries. It follows the "Magic Folder" principle: you drop files in, and a documentation site comes out.

## How it works

1.  **Drop Patterns:** Add `.html` files (or folders) to `src/patterns/`.
2.  **Add Styles:** Add standard CSS to `src/css/styles.css`.
3.  **Build:** Run `node build.js`.

## Features

### 1. The Magic Folder
*   **Single File:** Drop `button.html` into `src/patterns/`. It automatically appears in the library.
*   **Component Folder:** Drop a folder like `src/patterns/carousel/` containing `index.html`. It works exactly the same way.

### 2. Automatic JS Bundling
If your component needs client-side JavaScript, just add a `.js` file to its folder.
*   Example: `src/patterns/carousel/script.js`
*   **SwatchKit** will automatically find it, wrap it in an IIFE (to protect scope), and bundle it into the final site. You can have multiple JS files per pattern.

### 3. Zero Config
No config files. No build pipelines. No complex templating engines. Just HTML, CSS, and JS.

## Usage

```bash
# Build the library
node build.js

# View the library
open dist/index.html
```