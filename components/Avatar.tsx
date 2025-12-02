import React from "react";

function Avatar({ url }: { url?: string | null }) {
  return (
    <span
      className="ticket-card__avatar"
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    />
  );
}

export default Avatar;
