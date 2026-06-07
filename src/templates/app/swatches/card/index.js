import { renderCard } from "../../../src/components/card.js";

const html = String.raw;

export default html`
  <h2>Card</h2>
  <p>
    Uses <code>renderCard</code> (<code>src/components/card.js</code>), which
    itself composes <code>renderButton</code> for its CTA.
  </p>

  <div class="switcher gap">
    ${renderCard({
      title: "Project Aurora",
      body: "A soft editorial brand built on the SwatchKit token system.",
      ctaLabel: "View brand",
      ctaHref: "#aurora",
    })}
    ${renderCard({
      title: "No CTA",
      body: "Cards render fine without a call-to-action button too.",
    })}
  </div>
`;
