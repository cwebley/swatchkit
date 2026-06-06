/**
 * SwatchKit Token Parser (v5)
 *
 * CSS is the single source of truth for design tokens. This module reads the
 * CSS files listed in `tokenSources`, finds `@swatchkit` comment markers, and
 * extracts the custom-property declarations between each open marker and its
 * matching `@swatchkit end`.
 *
 * Marker grammar:
 *
 *   /* @swatchkit <type> "<label>" *\/
 *     --token-name: value;
 *   /* @swatchkit end *\/
 *
 * Values are captured VERBATIM (whitespace-normalized) — no resolution, no
 * evaluation. Relational values like `oklch(from var(--x) calc(l + 0.1) c h)`
 * are preserved exactly so the documentation shows the authored intent.
 *
 * Blocks may appear under any selector and inside @layer / @media / nesting;
 * PostCSS walks into all of them.
 */

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

// The known token types. Each maps to a docs renderer + utility emitter
// elsewhere (src/generators). `viewports` is docs-only (no utilities).
const TOKEN_TYPES = [
  "colors",
  "spacing",
  "text-sizes",
  "text-weights",
  "text-leading",
  "fonts",
  "viewports",
];

const OPEN_RE = /^@swatchkit\s+(\S+)\s+"([^"]*)"$/;
const END_RE = /^@swatchkit\s+end$/;

class TokenParseError extends Error {}

/**
 * Normalize a captured custom-property value.
 * PostCSS preserves multi-line values verbatim, which can leave awkward
 * whitespace (e.g. `oklch(\n  from ... )`). Collapse internal whitespace to
 * single spaces, and tighten the spaces just inside parentheses so a
 * multi-line `oklch(` does not render as `oklch( from ...)`.
 */
function normalizeValue(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

/**
 * Resolve a list of glob-ish source patterns to actual existing files.
 * Supports only a single trailing `*` wildcard on the basename (e.g.
 * `tokens/*.css`), which covers the default and the common case without
 * pulling in a glob dependency.
 */
function resolveTokenSources(tokenSources, cwd) {
  const files = [];
  const seen = new Set();

  for (const pattern of tokenSources) {
    const resolved = path.resolve(cwd, pattern);

    if (pattern.includes("*")) {
      const dir = path.dirname(resolved);
      const base = path.basename(resolved); // e.g. "*.css"
      if (!fs.existsSync(dir)) continue;
      const prefix = base.startsWith("*") ? "" : base.slice(0, base.indexOf("*"));
      const suffix = base.endsWith("*") ? "" : base.slice(base.indexOf("*") + 1);
      for (const entry of fs.readdirSync(dir)) {
        if (entry.startsWith(prefix) && entry.endsWith(suffix)) {
          const full = path.join(dir, entry);
          if (fs.statSync(full).isFile() && !seen.has(full)) {
            seen.add(full);
            files.push(full);
          }
        }
      }
    } else {
      if (fs.existsSync(resolved) && !seen.has(resolved)) {
        seen.add(resolved);
        files.push(resolved);
      }
    }
  }

  return files;
}

/**
 * Build the at-rule chain (e.g. ["@media (prefers-color-scheme: dark)"]) for a
 * node, walking up its parents. Used as docs metadata.
 */
function atRuleChain(node) {
  const chain = [];
  let parent = node.parent;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule") {
      chain.unshift(`@${parent.name} ${parent.params}`.trim());
    }
    parent = parent.parent;
  }
  return chain;
}

/**
 * Parse a single CSS file's content into token blocks.
 * Returns an array of blocks; throws TokenParseError on malformed markers.
 */
function parseTokenBlocksFromCss(css, sourceFile) {
  const root = postcss.parse(css, { from: sourceFile });
  const blocks = [];
  let current = null; // open block being filled
  let openLine = null;

  root.walk((node) => {
    if (node.type === "comment") {
      const text = node.text.trim();

      const openMatch = text.match(OPEN_RE);
      if (openMatch) {
        if (current) {
          throw new TokenParseError(
            `Nested or unclosed @swatchkit block in ${sourceFile}:${current.sourceLine} ` +
              `(found a new open marker at line ${node.source.start.line} before "@swatchkit end").`,
          );
        }
        const [, type, label] = openMatch;
        if (!TOKEN_TYPES.includes(type)) {
          throw new TokenParseError(
            `Unknown token type "${type}" in ${sourceFile}:${node.source.start.line}. ` +
              `Valid types: ${TOKEN_TYPES.join(", ")}.`,
          );
        }
        current = {
          type,
          label,
          parentSelector:
            node.parent && node.parent.type === "rule"
              ? node.parent.selector
              : "(root-level)",
          atRuleChain: atRuleChain(node),
          sourceFile,
          sourceLine: node.source.start.line,
          tokens: [],
        };
        openLine = node.source.start.line;
        return;
      }

      if (END_RE.test(text)) {
        if (!current) {
          throw new TokenParseError(
            `"@swatchkit end" with no open block in ${sourceFile}:${node.source.start.line}.`,
          );
        }
        blocks.push(current);
        current = null;
        openLine = null;
        return;
      }

      // A comment that looks like ours but doesn't match either form.
      if (/^@swatchkit\b/.test(text)) {
        throw new TokenParseError(
          `Malformed @swatchkit marker in ${sourceFile}:${node.source.start.line}: ` +
            `/* ${text} */. Expected /* @swatchkit <type> "Label" */ or /* @swatchkit end */.`,
        );
      }
      return;
    }

    if (current && node.type === "decl" && node.prop.startsWith("--")) {
      current.tokens.push({
        name: node.prop,
        value: normalizeValue(node.value),
      });
    }
  });

  if (current) {
    throw new TokenParseError(
      `Unclosed @swatchkit block in ${sourceFile}:${openLine} ` +
        `("@swatchkit ${current.type} \\"${current.label}\\"" has no matching "@swatchkit end").`,
    );
  }

  return blocks;
}

/**
 * Parse all token blocks from the resolved tokenSources.
 *
 * @param {string[]} tokenSources  glob-ish patterns (relative to cwd)
 * @param {string} cwd
 * @returns {Array} blocks in source order across all files
 */
function parseTokenBlocks(tokenSources, cwd = process.cwd()) {
  const files = resolveTokenSources(tokenSources, cwd);
  const blocks = [];
  for (const file of files) {
    const css = fs.readFileSync(file, "utf-8");
    const fileBlocks = parseTokenBlocksFromCss(css, file);
    blocks.push(...fileBlocks);
  }
  return blocks;
}

module.exports = {
  TOKEN_TYPES,
  TokenParseError,
  parseTokenBlocks,
  parseTokenBlocksFromCss,
  resolveTokenSources,
  normalizeValue,
};
