import { Button } from "./Button.jsx";

export function Card({ title, body, ctaLabel, ctaHref }) {
  return (
    <article className="card flow">
      <h3 className="card-title">{title}</h3>
      <p className="card-body">{body}</p>
      {ctaLabel ? (
        <div className="card-footer">
          <Button href={ctaHref}>{ctaLabel}</Button>
        </div>
      ) : null}
    </article>
  );
}
