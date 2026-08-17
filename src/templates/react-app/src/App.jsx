import { ButtonGallery } from "./components/ButtonGallery.jsx";
import { Card } from "./components/Card.jsx";

export default function App() {
  return (
    <main className="wrapper region flow">
      <header className="flow">
        <h1>My SwatchKit React App</h1>
        <p>
          These components are used by both the React app and the SwatchKit
          previews.
        </p>
        <p>
          <a href="/swatchkit/">Open the pattern library</a>
        </p>
      </header>

      <section className="flow">
        <h2>Buttons</h2>
        <ButtonGallery />
      </section>

      <section className="flow">
        <h2>Card</h2>
        <Card
          title="Project Aurora"
          body="A soft editorial brand built on the SwatchKit token system."
          ctaLabel="View brand"
          ctaHref="#aurora"
        />
      </section>
    </main>
  );
}
