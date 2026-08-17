import { renderToString } from "react-dom/server";
import { ButtonGallery } from "../../../src/components/ButtonGallery.jsx";

export default `
  <h2>Buttons</h2>
  <p>
    This swatch server-renders one React tree, then hydrates the same tree so
    each button keeps its click handler.
  </p>
  <div id="button-gallery-root">
    ${renderToString(<ButtonGallery />)}
  </div>
`;
