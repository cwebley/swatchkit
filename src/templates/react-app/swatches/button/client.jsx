import { hydrateRoot } from "react-dom/client";
import { ButtonGallery } from "../../../src/components/ButtonGallery.jsx";

hydrateRoot(
  document.querySelector("#button-gallery-root"),
  <ButtonGallery />,
);
