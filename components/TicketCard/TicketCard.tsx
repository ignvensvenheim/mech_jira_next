"use client";

import React from "react";
import type { NormalizedIssue } from "@/lib/jira";
import "./ticketCard.css";
import { getStatusClassName } from "@/helpers/getStatusClassName";
import Avatar from "@/components/Avatar";
import { fmtDuration } from "@/helpers/fmtDuration";
import { relativeDate } from "@/helpers/relativeDate";
import Chip from "@/components/Chip";

export const TicketCard = React.memo(function TicketCard({
  issue: i,
  onOpen,
}: {
  issue: NormalizedIssue;
  onOpen: (issue: NormalizedIssue) => void;
}) {
  const attachmentCount = Array.isArray(i.attachment) ? i.attachment.length : 0;
  const mechanics = Array.isArray(i.mechanicsRaw)
    ? i.mechanicsRaw.map((m: { value?: string }) => m.value).filter(Boolean)
    : [];

  return (
    <div className="ticket-card" onClick={() => onOpen(i)}>
      <div className="ticket-card__header">
        <p className="ticket-card__key">{i.key}</p>
        <div className="ticket-card__header-right">
          {attachmentCount > 0 && (
            <span className="ticket-card__attachment-indicator">
              Attachment
            </span>
          )}
          <span className={getStatusClassName(i.statusCategory)}>{i.status}</span>
        </div>
      </div>

      <div className="ticket-card__summary">{i.summary}</div>

      {i.descriptionText && (
        <div className="ticket-card__description">{i.descriptionText}</div>
      )}

      <div className="ticket-card__chips">
        <Chip text={`Created: ${relativeDate(i.created)}`} />
        <Chip text={`Time: ${fmtDuration(i.timeSpentSeconds)}`} />
        {attachmentCount > 0 && <Chip text={`Attachments: ${attachmentCount}`} />}
      </div>

      <div className="ticket-card__users">
        <div className="ticket-card__user">
          <Avatar url="https://cdn-icons-png.flaticon.com/512/2494/2494496.png" />
          <div className="ticket-card__mechanics">
            {mechanics.length > 0 ? mechanics.join(", ") : "-"}
          </div>
        </div>

        <div className="ticket-card__user">
          <Avatar url={i.reporter?.avatar} />
          <span>Reporter: {i.reporter?.name || "-"}</span>
        </div>
      </div>
    </div>
  );
});
