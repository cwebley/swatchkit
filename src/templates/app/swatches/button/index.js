import { renderButton } from "../../../src/components/button.js";

const html = String.raw;

export default html`
  <h2>Button</h2>
  <p>
    Same <code>renderButton</code> function as the main app
    (<code>src/components/button.js</code>). Edit it once, both update.
  </p>

  <h3>Variants</h3>
  <div class="cluster gap">
    ${renderButton({ label: "Primary" })}
    ${renderButton({ label: "Outline", variant: "outline" })}
    ${renderButton({ label: "Danger", variant: "danger" })}
  </div>

  <h3>Sizes</h3>
  <div class="cluster gap">
    ${renderButton({ label: "Small", size: "small" })}
    ${renderButton({ label: "Default" })}
    ${renderButton({ label: "Large", size: "large" })}
  </div>

  <h3>As a link</h3>
  ${renderButton({ label: "View brand", href: "#" })}
`;
