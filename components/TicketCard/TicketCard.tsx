"use client";

import React from "react";
import type { Issue } from "@/lib/types";
import "./ticketCard.css";
import type { NormalizedIssue } from "@/lib/jira";
import Link from "next/link";
import { getStatusClassName } from "@/helpers/getStatusClassName";
import Avatar from "@/components/Avatar";
import { fmtDuration } from "@/helpers/fmtDuration";
import { relativeDate } from "@/helpers/relativeDate";
import { truncate } from "@/helpers/truncate";
import Chip from "@/components/Chip";

export function TicketCard({ issue: i }: { issue: NormalizedIssue }) {
  const url = i.requestUrl ?? `https://svenheim.atlassian.net/browse/${i.key}`;

  return (
    <Link
      href={`/${i.key}`}
      target="_blank"
      rel="noopener noreferrer"
      className="ticket-card"
    >
      <div className="ticket-card__header">
        <p className="ticket-card__key">{i.key}</p>
        <span className={getStatusClassName(i.statusCategory)}>{i.status}</span>
      </div>

      <div className="ticket-card__summary">{i.summary}</div>

      {i.descriptionText && (
        <div className="ticket-card__description">
          {truncate(i.descriptionText, 180)}
        </div>
      )}

      <div className="ticket-card__chips">
        <Chip text={`Time spent: ${fmtDuration(i.timeSpentSeconds)}`} />
        <Chip text={`${relativeDate(i.created)}`} />
      </div>

      <div className="ticket-card__users">
        <div className="ticket-card__user">
          <Avatar url="https://cdn-icons-png.flaticon.com/512/2494/2494496.png" />
          <div className="ticket-card__mechanics">
            {Array.isArray(i.mechanicsRaw)
              ? i.mechanicsRaw.map((m: { value: any }) => m.value).join(", ")
              : "—"}
          </div>
        </div>

        <div className="ticket-card__user">
          <Avatar url={i.reporter?.avatar} />
          <span>Reporter: {i.reporter?.name || "—"}</span>
        </div>
      </div>
    </Link>
  );
}
