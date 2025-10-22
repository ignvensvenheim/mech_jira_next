"use client";

import React from "react";
import type { Issue, Paging, ApiResponse, Filters } from "@/lib/types";

export const DEFAULT_FILTERS: Filters = {
  project: "MECH",
  text: "",
  statuses: [],
  priorities: [],
  assignee: "",
  createdFrom: "",
  createdTo: "",
  orderBy: "created desc",
  maxResults: 20,
};

const DEBOUNCE_MS = 500;
// Jira caps per-page ~100. We'll use 100 when "All" is selected.
const PAGE_CAP_FOR_ALL = 100;
// Safety: cap total auto pages to avoid fetching tens of thousands unintentionally.
const MAX_AUTO_PAGES = 50; // 50 * 100 = up to ~5,000 issues

function jqlQuote(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildJql(f: Filters): string {
  const clauses: string[] = [];
  if (f.project.trim()) clauses.push(`project = ${f.project.trim()}`);

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

  if (f.assignee === "me") clauses.push("assignee = currentUser()");
  else if (f.assignee === "unassigned") clauses.push("assignee is EMPTY");
  else if (f.assignee)
    clauses.push(`assignee in (accountId(${jqlQuote(f.assignee)}))`);

  if (f.createdFrom) clauses.push(`created >= ${f.createdFrom}`);
  if (f.createdTo) clauses.push(`created <= ${f.createdTo}`);

  let jql = clauses.join(" AND ");
  switch (f.orderBy) {
    case "created asc":
      jql += " ORDER BY created ASC";
      break;
    case "updated desc":
      jql += " ORDER BY updated DESC";
      break;
    case "updated asc":
      jql += " ORDER BY updated ASC";
      break;
    default:
      jql += " ORDER BY created DESC";
  }
  return jql.trim();
}

export function useJiraSearch() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [activeJql, setActiveJql] = React.useState<string>("");
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [paging, setPaging] = React.useState<Paging | undefined>(undefined);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const searchAbortRef = React.useRef<AbortController | null>(null);
  const loadMoreAbortRef = React.useRef<AbortController | null>(null);

  const fetchPage = React.useCallback(
    async (opts: {
      jql: string;
      token?: string;
      maxResults: number;
      signal?: AbortSignal;
    }) => {
      const url =
        `/api/jira/search?maxResults=${opts.maxResults}` +
        `&jql=${encodeURIComponent(opts.jql)}` +
        (opts.token ? `&nextPageToken=${encodeURIComponent(opts.token)}` : "");
      const r = await fetch(url, { cache: "no-store", signal: opts.signal });
      const text = await r.text();
      if (!r.ok) throw new Error(`API ${r.status}: ${text}`);
      return JSON.parse(text) as ApiResponse;
    },
    []
  );

  // Auto-apply filters with debounce, and auto-load when maxResults = 'all'
  React.useEffect(() => {
    loadMoreAbortRef.current?.abort(); // cancel any load-more when filters change
    searchAbortRef.current?.abort(); // abort previous search

    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;

    const t = setTimeout(async () => {
      try {
        setLoadingInitial(true);
        setError(null);

        const jql = buildJql(filters);
        setActiveJql(jql);

        const firstPageSize =
          filters.maxResults === "all" ? PAGE_CAP_FOR_ALL : filters.maxResults;
        const first = await fetchPage({
          jql,
          maxResults: firstPageSize,
          signal: ctrl.signal,
        });

        setIssues(Array.isArray(first.issues) ? first.issues : []);
        setPaging(first.paging);
        if (!ctrl.signal.aborted) setLoadingInitial(false);

        // Auto-load remaining pages if "All" selected
        if (
          filters.maxResults === "all" &&
          first.paging?.nextPageToken &&
          !first.paging?.isLast &&
          !ctrl.signal.aborted
        ) {
          setLoadingMore(true);
          let token = first.paging.nextPageToken || null;
          let lastPaging = first.paging;
          let pages = 1;

          while (
            token &&
            !lastPaging?.isLast &&
            pages < MAX_AUTO_PAGES &&
            !ctrl.signal.aborted
          ) {
            const more = await fetchPage({
              jql,
              maxResults: PAGE_CAP_FOR_ALL,
              token,
              signal: ctrl.signal,
            });
            setIssues((prev) =>
              prev.concat(Array.isArray(more.issues) ? more.issues : [])
            );
            lastPaging = more.paging || lastPaging;
            token = more.paging?.nextPageToken || null;
            pages += 1;
          }

          setPaging(lastPaging);
          if (!ctrl.signal.aborted) setLoadingMore(false);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setIssues([]);
          setPaging(undefined);
          setError(e?.message || String(e));
          setLoadingInitial(false);
          setLoadingMore(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [filters, fetchPage]);

  const resetFilters = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const loadMore = React.useCallback(async () => {
    if (!paging?.nextPageToken || paging.isLast || loadingMore) return;
    loadMoreAbortRef.current?.abort();
    const ctrl = new AbortController();
    loadMoreAbortRef.current = ctrl;

    try {
      setLoadingMore(true);
      setError(null);
      const pageSize =
        filters.maxResults === "all" ? PAGE_CAP_FOR_ALL : filters.maxResults;
      const json = await fetchPage({
        jql: activeJql || buildJql(filters),
        token: paging.nextPageToken || undefined,
        maxResults: pageSize,
        signal: ctrl.signal,
      });
      setIssues((prev) =>
        prev.concat(Array.isArray(json.issues) ? json.issues : [])
      );
      setPaging(json.paging);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || String(e));
    } finally {
      if (!ctrl.signal.aborted) setLoadingMore(false);
    }
  }, [
    paging?.nextPageToken,
    paging?.isLast,
    loadingMore,
    fetchPage,
    activeJql,
    filters,
  ]);

  // Derived options
  const statusOptions = React.useMemo(
    () =>
      Array.from(new Set(issues.map((i) => i.status).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [issues]
  );
  const priorityOptions = React.useMemo(
    () =>
      Array.from(
        new Set(issues.map((i) => i.priority || "").filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [issues]
  );
  const assigneeOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of issues)
      if (i.assignee?.id && i.assignee.name)
        seen.set(i.assignee.id, i.assignee.name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [issues]);

  return {
    // state
    filters,
    setFilters,
    issues,
    paging,
    loadingInitial,
    loadingMore,
    error,
    // derived
    statusOptions,
    priorityOptions,
    assigneeOptions,
    // actions
    loadMore,
    resetFilters,
  };
}
