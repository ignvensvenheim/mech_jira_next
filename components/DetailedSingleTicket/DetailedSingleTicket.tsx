"use client";

import "./detailedSingleTicket.css";
import React, { useEffect, useState } from "react";
import type { NormalizedIssue } from "@/lib/jira";
import { Oval } from "react-loader-spinner";
import { relativeDate } from "@/helpers/relativeDate";
import Avatar from "../Avatar";

type Attachment = {
  id: string;
  filename: string;
  mimeType?: string;
  blobUrl?: string;
};

export function DetailedSingleTicket({
  issue,
  loadingDetail = false,
}: {
  issue: NormalizedIssue;
  loadingDetail?: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    const urls: string[] = [];

    const load = async () => {
      setAttachments([]);

      if (!issue?.attachment?.length) return;

      setLoadingAttachments(true);

      try {
        const results = await Promise.all(
          issue.attachment.map(async (a: any) => {
            const res = await fetch(`/api/jira/attachment/content/${a.id}`);
            if (!res.ok) throw new Error(`Failed to fetch attachment ${a.id}`);

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            urls.push(blobUrl);

            return {
              id: a.id,
              filename: a.filename,
              mimeType: blob.type,
              blobUrl,
            };
          })
        );

        setAttachments(results);
      } catch (err) {
        console.error("Error fetching attachments:", err);
      } finally {
        setLoadingAttachments(false);
      }
    };

    load();

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [issue]);

  if (loadingDetail) {
    return (
      <div className="page__loading">
        <Oval visible={true} height={80} width={80} color="#4fa94d" />
      </div>
    );
  }

  const mechanics = Array.isArray(issue.mechanicsRaw)
    ? issue.mechanicsRaw.map((m: any) => m.value).join(", ")
    : "-";

  return (
    <div className="detailed-ticket">
      <section className="detailed-ticket__section">
        <h3 className="detailed-ticket__section-title">Overview</h3>
        <div className="detailed-ticket__meta-grid">
          <div className="detailed-ticket__meta-item">
            <span className="detailed-ticket__label">Created</span>
            <span>{relativeDate(issue.created)}</span>
          </div>
          <div className="detailed-ticket__meta-item">
            <span className="detailed-ticket__label">Updated</span>
            <span>{relativeDate(issue.updated || issue.created)}</span>
          </div>
          <div className="detailed-ticket__meta-item">
            <span className="detailed-ticket__label">Time Spent</span>
            <span>{issue.timeSpentSeconds ? `${Math.round(issue.timeSpentSeconds / 60)} min` : "0 min"}</span>
          </div>
          <div className="detailed-ticket__meta-item">
            <span className="detailed-ticket__label">Priority</span>
            <span>{issue.priority || "-"}</span>
          </div>
        </div>
      </section>

      <section className="detailed-ticket__section">
        <h3 className="detailed-ticket__section-title">People</h3>
        <div className="detailed-ticket__person-row">
          <Avatar url={issue.reporter?.avatar} />
          <span>Reporter: {issue.reporter?.name || "-"}</span>
        </div>
        <div className="detailed-ticket__person-row">
          <Avatar url="https://cdn-icons-png.flaticon.com/512/2494/2494496.png" />
          <span>Mechanics: {mechanics || "-"}</span>
        </div>
      </section>

      <section className="detailed-ticket__section">
        <h3 className="detailed-ticket__section-title">Attachments</h3>

        {loadingAttachments && (
          <div className="page__loading">
            <Oval visible={true} height={60} width={60} color="#4fa94d" />
          </div>
        )}

        {!loadingAttachments && attachments.length === 0 && (
          <p className="detailed-ticket__empty">No attachments.</p>
        )}

        {!loadingAttachments && attachments.length > 0 && (
          <div className="detailed-ticket__attachments">
            {attachments.map((a) => (
              <div key={a.id} className="detailed-ticket__attachment-item">
                <p className="detailed-ticket__attachment-name">{a.filename}</p>
                {a.mimeType?.startsWith("image/") ? (
                  <img src={a.blobUrl} alt={a.filename} className="detailed-ticket__attachment-image" />
                ) : (
                  <a href={a.blobUrl} download={a.filename} className="detailed-ticket__download-link">
                    Download file
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="detailed-ticket__section">
        <h3 className="detailed-ticket__section-title">Comments</h3>
        {Array.isArray(issue.comments) && issue.comments.length > 0 ? (
          <div className="detailed-ticket__comments-list">
            {issue.comments.map((c) => (
              <article key={c.id} className="detailed-ticket__comment-item">
                <div className="detailed-ticket__comment-meta">
                  <span className="detailed-ticket__comment-author">
                    {c.author?.name || "Unknown"}
                  </span>
                  <span className="detailed-ticket__comment-date">
                    {relativeDate(c.created)}
                  </span>
                </div>
                <p className="detailed-ticket__comment">{c.body || "-"}</p>
              </article>
            ))}
          </div>
        ) : issue.descriptionText ? (
          <>
            <p className="detailed-ticket__label">Initial note</p>
            <p className="detailed-ticket__comment">{issue.descriptionText}</p>
          </>
        ) : (
          <p className="detailed-ticket__empty">No comments yet.</p>
        )}
      </section>
    </div>
  );
}
