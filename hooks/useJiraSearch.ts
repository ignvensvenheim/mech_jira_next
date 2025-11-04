"use client";

import React from "react";
import type { Issue, ApiResponse } from "@/lib/types";

const PROJECT_KEY = "MECH";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export function useJiraSearch(dateFrom?: string, dateTo?: string) {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ loaded: number }>({
    loaded: 0,
  });

  const fetchPage = React.useCallback(
    async (token?: string) => {
      const params = new URLSearchParams();

      // build JQL with optional date filters
      let jql = `project = ${PROJECT_KEY}`;
      if (dateFrom) jql += ` AND created >= "${dateFrom}"`;
      if (dateTo) jql += ` AND created <= "${dateTo}"`;
      jql += " ORDER BY created DESC";

      params.set("jql", jql);
      params.set("maxResults", PAGE_SIZE.toString());
      if (token) params.set("nextPageToken", token);

      const r = await fetch(`/api/jira/search?${params}`, {
        cache: "no-store",
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      return json as ApiResponse;
    },
    [dateFrom, dateTo]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress({ loaded: 0 });

        let all: Issue[] = [];
        let token: string | null = null;
        let pages = 0;

        do {
          const { issues, paging } = await fetchPage(token || undefined);
          all = all.concat(issues);
          setProgress({ loaded: all.length });
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

    run();
    return () => controller.abort();
  }, [fetchPage]);

  return {
    issues,
    loadingInitial: loading,
    error,
    progress,
  };
}
