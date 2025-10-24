"use client";

import React from "react";
import type { Issue } from "@/lib/types";

export function IssueCard({ issue: i }: { issue: Issue }) {
  const url =
    i.requestUrl ?? `https://your-domain.atlassian.net/browse/${i.key}`; // replace your-domain

  return (
    <article
      style={{
        padding: 14,
        border: "1px solid #EBECF0",
        borderRadius: 12,
        background: "#FFFFFF",
        boxShadow: "0 1px 2px rgba(9,30,66,0.08)",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", color: "#172B4D" }}
        >
          <strong>{i.key}</strong>
        </a>
        <span style={statusPillStyle(i.statusCategory)}>{i.status}</span>
      </div>

      <div style={{ fontSize: 15, color: "#091E42" }}>{i.summary}</div>

      {i.descriptionText && (
        <div style={{ color: "#6B778C", whiteSpace: "pre-wrap" }}>
          {truncate(i.descriptionText, 180)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {i.priority ? <Chip text={`Priority: ${i.priority}`} /> : null}
        {i.requestType ? (
          <Chip text={`Request: ${i.requestType}`} bg="#EAE6FF" fg="#403294" />
        ) : null}
        <Chip text={`Time: ${fmtDuration(i.timeSpentSeconds)}`} />
        <Chip text={`Created: ${relativeDate(i.created)}`} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          color: "#6B778C",
          fontSize: 13,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Avatar url={i.assignee?.avatar} />
          <span>Assignee: {i.assignee?.name || "—"}</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Avatar url={i.reporter?.avatar} />
          <span>Reporter: {i.reporter?.name || "—"}</span>
        </div>
      </div>
    </article>
  );
}

function Avatar({ url }: { url?: string | null }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#DFE1E6",
        display: "inline-block",
      }}
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
    <span
      style={{
        background: bg,
        color: fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #EBECF0",
      }}
    >
      {text}
    </span>
  );
}

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

function statusPillStyle(category?: string): React.CSSProperties {
  const k = (category || "").toLowerCase();
  const base = {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600 as const,
  };
  if (k === "done") return { ...base, background: "#E3FCEF", color: "#006644" };
  if (k === "indeterminate")
    return { ...base, background: "#DEEBFF", color: "#0747A6" };
  return { ...base, background: "#F4F5F7", color: "#42526E" };
}
