import React from "react";

function Chip({ text }: { text: string }) {
  return <span className="ticket-card__chip">{text}</span>;
}

export default Chip;
