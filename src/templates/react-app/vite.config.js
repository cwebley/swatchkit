import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SwatchKit writes the pattern library to public/swatchkit, so Vite serves it
// at /swatchkit/ in dev and copies it to dist/swatchkit/ on build with no
// extra wiring. The one gap is directory URLs: SwatchKit links previews as
// preview/swatches/button/, and Vite's public-dir handling does not resolve
// those to index.html, so they fall through to the app shell.
//
// This serves the file itself rather than rewriting the URL. In dev SwatchKit
// and Vite start in parallel, so public/swatchkit often appears after the
// server has booted, and a rewrite would depend on Vite having picked the
// file up.
function swatchkitDirectoryIndex() {
  return {
    name: "swatchkit-directory-index",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const [pathname] = (request.url || "/").split("?");
        if (!pathname.startsWith("/swatchkit")) {
          next();
          return;
        }

        if (pathname === "/swatchkit") {
          response.statusCode = 302;
          response.setHeader("Location", "/swatchkit/");
          response.end();
          return;
        }

        if (!pathname.endsWith("/")) {
          next();
          return;
        }

        const indexFile = path.join("public", pathname, "index.html");
        if (!fs.existsSync(indexFile)) {
          next();
          return;
        }

        response.setHeader("Content-Type", "text/html");
        response.end(fs.readFileSync(indexFile));
      });
    },
  };
}

export default defineConfig({
  plugins: [swatchkitDirectoryIndex(), react()],
});
