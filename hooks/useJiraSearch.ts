"use client";

import React from "react";
import type { Issue, ApiResponse, Filters } from "@/lib/types";

const PROJECT_KEY = "MECH";

export const DEFAULT_FILTERS: Filters = {
  text: "",
  statuses: [],
  priorities: [],
  requestTypes: [],
  assignee: "",
  createdFrom: "",
  createdTo: "",
  orderBy: "created desc",
  maxResults: "all", // ✅ always load everything
};

const DEBOUNCE_MS = 500;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

function jqlQuote(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function useJiraSearch() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [progress, setProgress] = React.useState<{
    loaded: number;
    total?: number;
  }>({ loaded: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [statusOptions, setStatusOptions] = React.useState<string[]>([]);
  const [priorityOptions, setPriorityOptions] = React.useState<string[]>([]);
  const [requestTypeOptions, setRequestTypeOptions] = React.useState<string[]>(
    []
  );
  const [assigneeOptions, setAssigneeOptions] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [requestTypeFieldName, setRequestTypeFieldName] =
    React.useState<string>("Request Type");

  // Load meta options
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `/api/jira/meta/options?projectKey=${PROJECT_KEY}`,
          { cache: "no-store" }
        );
        const data = await r.json();
        setStatusOptions(data.options.statuses || []);
        setPriorityOptions(data.options.priorities || []);
        setRequestTypeOptions(data.options.requestTypes || []);
        setAssigneeOptions(
          (data.options.assignees || []).map((a: any) => ({
            id: a.id,
            name: a.name,
          }))
        );
        if (data.fieldNames?.requestType)
          setRequestTypeFieldName(data.fieldNames.requestType);
      } catch {}
    })();
  }, []);

  const buildJql = React.useCallback(
    (f: Filters) => {
      const clauses: string[] = [`project = ${PROJECT_KEY}`];

      if (f.text.trim()) {
        const t = f.text.trim();
        clauses.push(
          `(summary ~ ${jqlQuote(t)} OR description ~ ${jqlQuote(
            t
          )} OR comment ~ ${jqlQuote(t)})`
        );
      }
      if (f.statuses.length)
        clauses.push(`status in (${f.statuses.map(jqlQuote).join(", ")})`);
      if (f.priorities.length)
        clauses.push(`priority in (${f.priorities.map(jqlQuote).join(", ")})`);
      if (f.requestTypes.length)
        clauses.push(
          `"${requestTypeFieldName}" in (${f.requestTypes
            .map(jqlQuote)
            .join(", ")})`
        );
      if (f.assignee === "me") clauses.push("assignee = currentUser()");
      else if (f.assignee === "unassigned") clauses.push("assignee is EMPTY");
      else if (f.assignee)
        clauses.push(`assignee in (accountId(${jqlQuote(f.assignee)}))`);
      if (f.createdFrom) clauses.push(`created >= ${f.createdFrom}`);
      if (f.createdTo) clauses.push(`created <= ${f.createdTo}`);

      return clauses.join(" AND ") + " ORDER BY created DESC";
    },
    [requestTypeFieldName]
  );

  const fetchPage = React.useCallback(async (jql: string, token?: string) => {
    const params = new URLSearchParams();
    params.set("jql", jql);
    params.set("maxResults", PAGE_SIZE.toString());
    if (token) params.set("nextPageToken", token);
    const r = await fetch(`/api/jira/search?${params}`, { cache: "no-store" });
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    return json as ApiResponse;
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress({ loaded: 0, total: undefined });

        const jql = buildJql(filters);

        let all: Issue[] = [];
        let token: string | null = null;
        let pages = 0;

        do {
          const { issues, paging } = await fetchPage(jql, token || undefined);
          all = all.concat(issues);

          setProgress({
            loaded: all.length,
          });

          token = paging?.nextPageToken || null;
          pages++;
        } while (token && pages < MAX_PAGES && !signal.aborted);

        if (!signal.aborted) {
          setIssues(all);
          setLoading(false);
          try {
            localStorage.setItem("jiraIssuesCache", JSON.stringify(all));
          } catch {}
        }
      } catch (e: any) {
        if (!signal.aborted) {
          setError(String(e.message || e));
          setIssues([]);
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, buildJql, fetchPage]);

  return {
    filters,
    setFilters,
    issues,
    loadingInitial: loading,
    error,
    statusOptions,
    priorityOptions,
    requestTypeOptions,
    assigneeOptions,
    resetFilters: () => setFilters(DEFAULT_FILTERS),
    progress,
  };
}
