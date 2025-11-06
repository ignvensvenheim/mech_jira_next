"use client";

import React from "react";
import type { Issue } from "@/lib/types";
import "./ticketCard.css";
import type { NormalizedIssue } from "@/lib/jira";
import Link from "next/link";

export function TicketCard({ issue: i }: { issue: NormalizedIssue }) {
  const url = i.requestUrl ?? `https://svenheim.atlassian.net/browse/${i.key}`;

  return (
    <Link
      target="_blank"
      rel="noopener noreferrer"
      className="ticket-card"
      onClick={() => console.log(i.id)}
      href={`/${i.key}`}
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

function Avatar({ url }: { url?: string | null }) {
  return (
    <span
      className="ticket-card__avatar"
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    />
  );
}

function Chip({ text }: { text: string }) {
  return <span className="ticket-card__chip">{text}</span>;
}

function getStatusClassName(category?: string): string {
  const k = (category || "").toLowerCase();
  const baseClass = "ticket-card__status";

  if (k === "done") return `${baseClass} ${baseClass}--done`;
  if (k === "indeterminate") return `${baseClass} ${baseClass}--indeterminate`;
  return `${baseClass} ${baseClass}--default`;
}

function fmtDuration(sec: number) {
  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec / 60))}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h ? `${h}h ` : ""}${m}m`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);

  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");

  return `${hh}:${mm} ${month}/${day}`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
