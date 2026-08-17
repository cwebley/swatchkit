import { useState } from "react";
import { Button } from "./Button.jsx";

const examples = [
  { label: "Primary", variant: "primary" },
  { label: "Outline", variant: "outline" },
  { label: "Danger", variant: "danger" },
];

export function ButtonGallery() {
  const [lastAction, setLastAction] = useState("");

  return (
    <div className="flow">
      <div className="cluster gap">
        {examples.map(({ label, variant }) => (
          <Button
            key={variant}
            variant={variant}
            onClick={() => setLastAction(label)}
          >
            {label}
          </Button>
        ))}
      </div>

      <p aria-live="polite">
        {lastAction ? `${lastAction} clicked` : "Choose a button"}
      </p>
    </div>
  );
}
