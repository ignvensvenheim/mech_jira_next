"use client";

import React from "react";
import type { Issue, Paging, ApiResponse, Filters } from "@/lib/types";

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
  maxResults: 20, // or 'all'
};

const DEBOUNCE_MS = 500;
const PAGE_CAP_FOR_ALL = 100;
const MAX_AUTO_PAGES = 50;

function jqlQuote(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function useJiraSearch() {
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [activeJql, setActiveJql] = React.useState<string>("");
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [paging, setPaging] = React.useState<Paging | undefined>(undefined);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Options fetched from metadata
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

  // Load options from our meta endpoint once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/jira/meta/options?projectKey=${PROJECT_KEY}`,
          { cache: "no-store" }
        );
        const data = await r.json();
        if (cancelled) return;
        if (data?.options) {
          setStatusOptions(data.options.statuses || []);
          setPriorityOptions(data.options.priorities || []);
          setRequestTypeOptions(data.options.requestTypes || []);
          setAssigneeOptions(
            (data.options.assignees || []).map((a: any) => ({
              id: a.id,
              name: a.name,
            }))
          );
        }
        if (data?.fieldNames?.requestType)
          setRequestTypeFieldName(data.fieldNames.requestType);
      } catch {
        // leave empty on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const buildJql = React.useCallback(
    (f: Filters) => {
      const clauses: string[] = [];
      clauses.push(`project = ${PROJECT_KEY}`);

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
      if (f.requestTypes.length && requestTypeFieldName) {
        clauses.push(
          `"${requestTypeFieldName}" in (${f.requestTypes
            .map(jqlQuote)
            .join(", ")})`
        );
      }
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
    },
    [requestTypeFieldName]
  );

  // Debounced auto search; fetch ALL when typing or Size='all'
  React.useEffect(() => {
    loadMoreAbortRef.current?.abort();
    searchAbortRef.current?.abort();

    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;

    const t = setTimeout(async () => {
      try {
        setLoadingInitial(true);
        setError(null);

        const jql = buildJql(filters);
        setActiveJql(jql);

        const searchingText = filters.text.trim().length > 0;
        const wantAll = searchingText || filters.maxResults === "all";
        const firstPageSize = wantAll
          ? PAGE_CAP_FOR_ALL
          : (filters.maxResults as number);

        // First page
        const first = await fetchPage({
          jql,
          maxResults: firstPageSize,
          signal: ctrl.signal,
        });
        let allIssues = Array.isArray(first.issues) ? first.issues : [];
        let lastPaging = first.paging;

        // Auto-fetch rest if needed
        if (
          wantAll &&
          first.paging?.nextPageToken &&
          !first.paging?.isLast &&
          !ctrl.signal.aborted
        ) {
          setLoadingMore(true);
          let token = first.paging.nextPageToken || null;
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
            allIssues = allIssues.concat(
              Array.isArray(more.issues) ? more.issues : []
            );
            lastPaging = more.paging || lastPaging;
            token = more.paging?.nextPageToken || null;
            pages += 1;
          }
          if (!ctrl.signal.aborted) setLoadingMore(false);
        }

        if (!ctrl.signal.aborted) {
          setIssues(allIssues);
          setPaging(lastPaging);
          setLoadingInitial(false);
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
  }, [filters, buildJql, fetchPage]);

  const loadMore = React.useCallback(async () => {
    if (!paging?.nextPageToken || paging.isLast || loadingMore) return;
    loadMoreAbortRef.current?.abort();
    const ctrl = new AbortController();
    loadMoreAbortRef.current = ctrl;

    try {
      setLoadingMore(true);
      setError(null);

      const searchingText = filters.text.trim().length > 0;
      const pageSize =
        filters.maxResults === "all" || searchingText
          ? PAGE_CAP_FOR_ALL
          : (filters.maxResults as number);

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
    buildJql,
  ]);

  const resetFilters = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    // state
    filters,
    setFilters,
    issues,
    paging,
    loadingInitial,
    loadingMore,
    error,
    // options
    statusOptions,
    priorityOptions,
    requestTypeOptions,
    assigneeOptions,
    // actions
    loadMore,
    resetFilters,
  };
}
