"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";
import type { NormalizedIssue } from "@/lib/jira";
import "./ticketCard.css";
import { getStatusClassName } from "@/helpers/getStatusClassName";
import Avatar from "@/components/Avatar";
import { fmtDuration } from "@/helpers/fmtDuration";
import { relativeDate } from "@/helpers/relativeDate";
import Chip from "@/components/Chip";

function ListFieldIcon({ children }: { children: React.ReactNode }) {
  return <span className="ticket-card__list-icon" aria-hidden="true">{children}</span>;
}

export const TicketCard = React.memo(function TicketCard({
  issue: i,
  onOpen,
  view = "grid" as "grid" | "list",
}: {
  issue: NormalizedIssue;
  onOpen: (issue: NormalizedIssue) => void;
  view?: "grid" | "list";
}) {
  const { locale, t } = useI18n();
  const attachmentCount = Array.isArray(i.attachment) ? i.attachment.length : 0;
  const mechanics = Array.isArray(i.mechanicsRaw)
    ? i.mechanicsRaw.map((m: { value?: string }) => m.value).filter(Boolean)
    : [];

  if (view === "list") {
    return (
      <div className="ticket-card ticket-card--list" onClick={() => onOpen(i)}>
        <div className="ticket-card__list-field ticket-card__list-field--status">
          <span className={getStatusClassName(i.statusCategory)}>{i.status}</span>
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--key">
          {i.key}
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--summary">
          {i.summary}
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--attachment">
          {attachmentCount > 0 ? (
            <span className="ticket-card__attachment-indicator">
              {t("home.attachmentCount", { count: attachmentCount })}
            </span>
          ) : (
            "-"
          )}
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--with-icon">
          <ListFieldIcon>
            <svg viewBox="0 0 16 16" focusable="false">
              <circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M3.8 12.8c.7-1.8 2.3-2.9 4.2-2.9s3.5 1.1 4.2 2.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </ListFieldIcon>
          <span>{i.reporter?.name || "-"}</span>
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--with-icon">
          <ListFieldIcon>
            <svg viewBox="0 0 16 16" focusable="false">
              <path
                d="M12.8 2.8a3 3 0 0 0-3.8 3.8L4.2 11.4a1.4 1.4 0 1 0 2 2L11 8.6a3 3 0 0 0 3.8-3.8l-1.8 1.1-1.5-.3-.3-1.5 1.1-1.8Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ListFieldIcon>
          <span>{mechanics.join(", ") || "-"}</span>
        </div>
        <div className="ticket-card__list-field">
          {relativeDate(i.created, locale)}
        </div>
        <div className="ticket-card__list-field ticket-card__list-field--with-icon">
          <ListFieldIcon>
            <svg viewBox="0 0 16 16" focusable="false">
              <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 5.2v3.1l2.1 1.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ListFieldIcon>
          <span>{fmtDuration(i.timeSpentSeconds, locale)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-card ticket-card--grid" onClick={() => onOpen(i)}>
      <div className="ticket-card__header">
        <p className="ticket-card__key">{i.key}</p>
        <div className="ticket-card__header-right">
          {attachmentCount > 0 && (
            <span className="ticket-card__attachment-indicator">
              {t("home.attachment")}
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
        <Chip text={t("home.createdLabel", { value: relativeDate(i.created, locale) })} />
        <Chip text={t("home.timeLabel", { value: fmtDuration(i.timeSpentSeconds, locale) })} />
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
          <span>{t("home.reporterLabel", { value: i.reporter?.name || "-" })}</span>
        </div>
      </div>
    </div>
  );
});
