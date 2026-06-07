/**
 * Button renderer — a pure function returning an HTML string.
 * Used by both the app (src/pages/home.js) and the pattern library
 * (swatchkit/swatches/button/index.js). One source of truth.
 *
 * @param {object} props
 * @param {string} props.label              - Visible button text
 * @param {string} [props.href]             - If set, renders an <a> instead of a <button>
 * @param {"primary"|"outline"|"danger"} [props.variant] - Visual style (default: primary)
 * @param {"small"|"large"} [props.size]    - Optional size modifier
 */
export function renderButton({ label, href, variant = "primary", size } = {}) {
  const classes = ["button"];
  if (variant === "outline") classes.push("outline");
  else if (variant === "danger") classes.push("danger");
  if (size === "small") classes.push("small");
  else if (size === "large") classes.push("large");

  const cls = classes.join(" ");
  return href
    ? `<a class="${cls}" href="${href}">${label}</a>`
    : `<button class="${cls}" type="button">${label}</button>`;
}
