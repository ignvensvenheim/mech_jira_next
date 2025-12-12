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

export function DetailedSingleTicket({ issue }: { issue: NormalizedIssue }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Load attachments
  useEffect(() => {
    const load = async () => {
      setLoading(false);

      if (!issue?.attachment?.length) return;

      setLoadingAttachments(true);

      try {
        const results = await Promise.all(
          issue.attachment.map(async (a: any) => {
            const res = await fetch(`/api/jira/attachment/content/${a.id}`);
            if (!res.ok) throw new Error(`Failed to fetch attachment ${a.id}`);

            const blob = await res.blob();

            return {
              id: a.id,
              filename: a.filename,
              mimeType: blob.type,
              blobUrl: URL.createObjectURL(blob),
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
  }, [issue]);

  const getStatusClassName = (category?: string): string => {
    const k = (category || "").toLowerCase();
    const base = "ticket-card__status";
    if (k === "done") return `${base} ${base}--done`;
    if (k === "indeterminate") return `${base} ${base}--indeterminate`;
    return `${base} ${base}--default`;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="ticket-card detailed">
      <div className="ticket-card__header">
        <p className="ticket-card__key">
          {issue.key} | {issue.summary}
        </p>
        <span className={getStatusClassName(issue.statusCategory)}>
          {issue.status}
        </span>
      </div>

      {/* Attachments loader */}
      {loadingAttachments && (
        <div className="page__loading">
          <Oval visible={true} height={80} width={80} color="#4fa94d" />
        </div>
      )}

      {/* Attachments */}
      {!loadingAttachments && attachments.length > 0 && (
        <div className="attachments">
          <div className="attachment-list">
            {attachments.map((a) => (
              <div key={a.id} className="attachment-item">
                {a.mimeType?.startsWith("image/") ? (
                  <img
                    src={a.blobUrl}
                    alt={a.filename}
                    style={{ borderRadius: "8px" }}
                  />
                ) : (
                  <a href={a.blobUrl} download={a.filename}>
                    Download file
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reporter */}
      <div className="ticket-card__user">
        <Avatar url={issue.reporter?.avatar} />
        <span>Reporter: {issue.reporter?.name || "—"}</span>
      </div>

      {/* Mechanics */}
      <div className="ticket-card__user">
        <Avatar url="https://cdn-icons-png.flaticon.com/512/2494/2494496.png" />
        <div className="ticket-card__mechanics">
          <span>Mechanics: </span>
          {Array.isArray(issue.mechanicsRaw)
            ? issue.mechanicsRaw.map((m: any) => m.value).join(", ")
            : "—"}
        </div>
      </div>

      <p>Created: {relativeDate(issue.created)}</p>

      {issue.descriptionText && (
        <p className="ticket-card__description-full">
          Description: {issue.descriptionText}
        </p>
      )}
    </div>
  );
}
