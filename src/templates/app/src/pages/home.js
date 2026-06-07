import { renderButton } from "../components/button.js";
import { renderCard } from "../components/card.js";

const html = String.raw;

export function home() {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My SwatchKit App</title>
    <link rel="stylesheet" href="./css/main.css" />
  </head>
  <body class="wrapper region flow">
    <header class="flow">
      <h1>My SwatchKit App</h1>
      <p>
        This page renders the same <code>renderButton</code> and
        <code>renderCard</code> functions used by the
        <a href="./swatchkit/">pattern library</a>. Edit a component once,
        both update.
      </p>
    </header>

    <section class="flow">
      <h2>Buttons</h2>
      <div class="cluster gap">
        ${renderButton({ label: "Primary" })}
        ${renderButton({ label: "Outline", variant: "outline" })}
        ${renderButton({ label: "Danger", variant: "danger" })}
        ${renderButton({ label: "Link button", href: "#" })}
      </div>
    </section>

    <section class="flow">
      <h2>Card</h2>
      ${renderCard({
        title: "Project Aurora",
        body: "A soft editorial brand built on the SwatchKit token system.",
        ctaLabel: "View brand",
        ctaHref: "#aurora",
      })}
    </section>

    <script type="module" src="./js/main.js"></script>
  </body>
</html>`;
}
