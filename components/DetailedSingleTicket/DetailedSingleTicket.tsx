"use client";

import "./detailedSingleTicket.css";
import React, { useEffect, useState } from "react";
import { useIssues } from "@/lib/IssuesContext";
import { useParams } from "next/navigation";
import type { NormalizedIssue } from "@/lib/jira";
import { ParamValue } from "next/dist/server/request/params";
import { Oval } from "react-loader-spinner"; // 👈 add your existing loader
import { relativeDate } from "@/helpers/relativeDate";
import Avatar from "../Avatar";

type Attachment = {
  id: string;
  filename: string;
  mimeType?: string;
  blobUrl?: string;
};

export function DetailedSingleTicket({ issue: i }: { issue: NormalizedIssue }) {
  const { issues, setIssues } = useIssues();
  const params = useParams();
  const issueKey = params.key as string;

  const [issue, setIssue] = useState<NormalizedIssue | null>(
    () =>
      issues.find((iss: { key: ParamValue }) => iss.key === issueKey) || null
  );
  const [loading, setLoading] = useState(!issue);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false); //

  useEffect(() => {
    if (!issue) {
      setLoading(true);
      const cached = localStorage.getItem("jiraIssuesCache");
      if (cached) {
        try {
          const parsed: NormalizedIssue[] = JSON.parse(cached);
          setIssues(parsed);
          const found = parsed.find((i) => i.key === issueKey) || null;
          setIssue(found);
        } catch (e) {
          console.error("Failed to parse cached issues", e);
        }
      }
      setLoading(false);
    }
  }, [issue, issueKey, setIssues]);

  useEffect(() => {
    if (!issue?.attachment?.length) return;

    const fetchAttachments = async () => {
      setLoadingInitial(true); //
      try {
        const results = await Promise.all(
          issue.attachment.map(async (a: any) => {
            const res = await fetch(`/api/jira/attachment/content/${a.id}`);

            if (!res.ok) throw new Error(`Failed to fetch attachment ${a.id}`);

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

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
        setLoadingInitial(false);
      }
    };

    fetchAttachments();
  }, [issue]);

  if (loading) return <div>Loading issue...</div>;
  if (!issue) return <div>Issue not found.</div>;
  function getStatusClassName(category?: string): string {
    const k = (category || "").toLowerCase();
    const baseClass = "ticket-card__status";

    if (k === "done") return `${baseClass} ${baseClass}--done`;
    if (k === "indeterminate")
      return `${baseClass} ${baseClass}--indeterminate`;
    return `${baseClass} ${baseClass}--default`;
  }

  return (
    <div className="ticket-card">
      <div className="ticket-card__header">
        <p className="ticket-card__key">
          {issue.key} | {issue.summary}
        </p>
        <span className={getStatusClassName(issue.statusCategory)}>
          {issue.status}
        </span>
      </div>
      {/* 🌀 Loader for attachments */}
      {loadingInitial && (
        <div className="page__loading">
          <Oval visible={true} height={80} width={80} color="#4fa94d" />
        </div>
      )}
      {/* 📎 Display attachments */}
      {!loadingInitial && attachments.length > 0 && (
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
      <div className="ticket-card__user">
        <Avatar url={issue.reporter?.avatar} />
        <span>Reporter: {issue.reporter?.name || "—"}</span>
      </div>
      <div className="ticket-card__user">
        <Avatar url="https://cdn-icons-png.flaticon.com/512/2494/2494496.png" />
        <div className="ticket-card__mechanics">
          <span>Mechanics: </span>
          {Array.isArray(issue.mechanicsRaw)
            ? issue.mechanicsRaw.map((m: { value: any }) => m.value).join(", ")
            : "—"}
        </div>
      </div>
      <p>Created: {relativeDate(issue.created)}</p>
      {issue.descriptionText && <p>Description: {issue.descriptionText}</p>}
    </div>
  );
}
