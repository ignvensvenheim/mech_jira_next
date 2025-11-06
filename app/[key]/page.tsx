"use client";

import React, { useEffect, useState } from "react";
import { useIssues } from "@/lib/IssuesContext";
import { useParams } from "next/navigation";
import type { NormalizedIssue } from "@/lib/jira";
import { ParamValue } from "next/dist/server/request/params";

export default function IssuePage() {
  const { issues, setIssues } = useIssues();
  const params = useParams();
  const issueKey = params.key;

  const [issue, setIssue] = useState<NormalizedIssue | null>(
    () => issues.find((i: { key: ParamValue }) => i.key === issueKey) || null
  );
  const [loading, setLoading] = useState(!issue);

  useEffect(() => {
    if (!issue) {
      setLoading(true);
      const cached = localStorage.getItem("jiraIssuesCache");
      if (cached) {
        try {
          const parsed: NormalizedIssue[] = JSON.parse(cached);
          setIssues(parsed); // populate context
          const found = parsed.find((i) => i.key === issueKey) || null;
          setIssue(found);
        } catch (e) {
          console.error("Failed to parse cached issues", e);
        }
      }
      setLoading(false);
    }
  }, [issue, issueKey, setIssues]);

  console.log(issue);

  if (loading) return <div>Loading issue...</div>;
  if (!issue) return <div>Issue not found.</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h1>
        {issue.key}: {issue.summary}
      </h1>
      <p>
        <strong>Status:</strong> {issue.status}
      </p>
      <p>
        <strong>Created:</strong> {new Date(issue.created).toLocaleString()}
      </p>
      <p>
        <strong>Updated:</strong> {new Date(issue.updated).toLocaleString()}
      </p>
      {issue.descriptionText && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Description</h2>
          <p>{issue.descriptionText}</p>
        </div>
      )}
      {issue.mechanics && issue.mechanics.length > 0 && (
        <p>{issue.mechanics.join(", ")}</p>
      )}
      <div style={{ marginTop: "1rem" }}>
        <strong>Reporter:</strong> {issue.reporter?.name || "—"} <br />
        <strong>Assignee:</strong> {issue.assignee?.name || "—"}
      </div>
    </div>
  );
}
