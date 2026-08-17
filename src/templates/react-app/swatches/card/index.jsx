import { renderToString } from "react-dom/server";
import { Card } from "../../../src/components/Card.jsx";

export default `
  <h2>Card</h2>
  <div id="card-root">
    ${renderToString(
      <Card
        title="Project Aurora"
        body="A soft editorial brand built on the SwatchKit token system."
        ctaLabel="View brand"
        ctaHref="#aurora"
      />,
    )}
  </div>
`;
