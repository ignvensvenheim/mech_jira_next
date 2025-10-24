"use client";

import React from "react";
import type { Issue } from "@/lib/types";
import "./ticketCard.css";

export function IssueCard({ issue: i }: { issue: Issue }) {
  const url =
    i.requestUrl ?? `https://your-domain.atlassian.net/browse/${i.key}`;

  const getStatusClass = (category?: string) => {
    const k = (category || "").toLowerCase();
    if (k === "done") return "ticket-card__status ticket-card__status--done";
    if (k === "indeterminate")
      return "ticket-card__status ticket-card__status--indeterminate";
    return "ticket-card__status";
  };

  const getStatusStyle = (category?: string) => {
    const k = (category || "").toLowerCase();
    if (k === "done") return { background: "#E3FCEF", color: "#006644" };
    if (k === "indeterminate")
      return { background: "#DEEBFF", color: "#0747A6" };
    return { background: "#F4F5F7", color: "#42526E" };
  };

  return (
    <article className="ticket-card">
      <div className="ticket-card__header">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ticket-card__key"
        >
          {i.key}
        </a>
        <span
          className={getStatusClass(i.statusCategory)}
          style={getStatusStyle(i.statusCategory)}
        >
          {i.status}
        </span>
      </div>

      <div className="ticket-card__summary">{i.summary}</div>

      {i.descriptionText && (
        <div className="ticket-card__description">
          {truncate(i.descriptionText, 180)}
        </div>
      )}

      <div className="ticket-card__chips">
        {i.priority && <Chip text={`Priority: ${i.priority}`} />}
        {i.requestType && (
          <Chip text={`Request: ${i.requestType}`} bg="#EAE6FF" fg="#403294" />
        )}
        <Chip text={`Time: ${fmtDuration(i.timeSpentSeconds)}`} />
        <Chip text={`Created: ${relativeDate(i.created)}`} />
      </div>

      <div className="ticket-card__assignee">
        <Avatar url={i.assignee?.avatar} />
        <span>Assignee: {i.assignee?.name || "—"}</span>
      </div>

      <div className="ticket-card__reporter">
        <Avatar url={i.reporter?.avatar} />
        <span>Reporter: {i.reporter?.name || "—"}</span>
      </div>
    </article>
  );
}

function Avatar({ url }: { url?: string | null }) {
  return (
    <span
      className="ticket-card__avatar"
      style={{ backgroundImage: url ? `url(${url})` : undefined }}
    />
  );
}

function Chip({
  text,
  bg = "#F4F5F7",
  fg = "#42526E",
}: {
  text: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <span className="ticket-card__chip" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}

// Utility functions
function fmtDuration(sec: number) {
  if (!sec || sec < 60) return `${Math.max(0, Math.round(sec / 60))}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h ? `${h}h ` : ""}${m}m`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const diff = (Date.now() - d.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(-diff), "second");
  if (abs < 3600) return rtf.format(Math.round(-diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(-diff / 3600), "hour");
  return rtf.format(Math.round(-diff / 86400), "day");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
