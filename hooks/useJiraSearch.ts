"use client";

import React from "react";
import type { ApiResponse, Issue } from "@/lib/types";
import { useIssues } from "@/lib/IssuesContext";
import type { NormalizedIssue } from "@/lib/jira";
import { normalizeIssues } from "@/lib/normalizeIssue";

const PROJECT_KEY = "MECH";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const CACHE_KEY = "jiraIssuesCache";
const LAST_SYNC_KEY = "jiraIssuesLastSyncAt";
const LAST_FULL_SYNC_KEY = "jiraIssuesLastFullSyncAt";
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000;
const WATERMARK_OVERLAP_MS = 60 * 1000;
const ACTIVE_POLL_MS = 10 * 1000;
const HIDDEN_POLL_MS = 60 * 1000;
const MIN_TRIGGER_GAP_MS = 2 * 1000;
const FULL_SYNC_EVERY_MS = 5 * 60 * 1000;

function byUpdatedDesc(a: NormalizedIssue, b: NormalizedIssue) {
  return (
    new Date(b.updated || b.created).getTime() -
    new Date(a.updated || a.created).getTime()
  );
}

function mergeIssues(
  existing: NormalizedIssue[],
  incoming: NormalizedIssue[]
): NormalizedIssue[] {
  const byId = new Map<string, NormalizedIssue>();
  for (const issue of existing) byId.set(issue.id, issue);
  for (const issue of incoming) byId.set(issue.id, issue);
  return [...byId.values()].sort(byUpdatedDesc);
}

function sanitizeWatermark(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  if (parsed > Date.now() + MAX_FUTURE_DRIFT_MS) return null;
  return new Date(Math.max(0, parsed - WATERMARK_OVERLAP_MS)).toISOString();
}

function isRecentIso(raw: string | null, maxAgeMs: number): boolean {
  if (!raw) return false;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= maxAgeMs;
}

export function useJiraSearch(dateFrom?: string, dateTo?: string) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ loaded: number }>({
    loaded: 0,
  });

  const { issues, setIssues } = useIssues();
  const issuesRef = React.useRef<NormalizedIssue[]>(issues);
  React.useEffect(() => {
    issuesRef.current = issues;
  }, [issues]);

  const fetchPage = React.useCallback(async (jql: string, token?: string) => {
    const params = new URLSearchParams();

    params.set("jql", jql);
    params.set("maxResults", PAGE_SIZE.toString());
    params.set("profile", "list");
    if (token) params.set("nextPageToken", token);

    const r = await fetch(`/api/jira/search?${params}`, {
      cache: "no-store",
    });
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    return json as ApiResponse;
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let hasHydratedCache = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let isRunning = false;
    let lastTriggerAt = 0;

    const lastFullSyncAt = localStorage.getItem(LAST_FULL_SYNC_KEY);
    const canHydrateCache = isRecentIso(lastFullSyncAt, FULL_SYNC_EVERY_MS);

    if (canHydrateCache) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Issue[];
          const cached = normalizeIssues(parsed);
          if (cached.length) {
            hasHydratedCache = true;
            setIssues(cached);
            setProgress({ loaded: cached.length });
            setLoading(false);
          }
        }
      } catch {
        // Ignore invalid cache
      }
    }

    const run = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        if (!hasHydratedCache) setLoading(true);
        setError(null);

        const buildJql = (updatedFrom: string | null) => {
          const clauses: string[] = [];
          if (dateFrom) clauses.push(`created >= "${dateFrom}"`);
          if (dateTo) clauses.push(`created <= "${dateTo}"`);
          if (updatedFrom) clauses.push(`updated >= "${updatedFrom}"`);

          let jql = `project = ${PROJECT_KEY}`;
          if (clauses.length > 0) jql += ` AND ${clauses.join(" AND ")}`;
          jql += " ORDER BY updated DESC";
          return jql;
        };

        const storedLastSync = localStorage.getItem(LAST_SYNC_KEY);
        const storedLastFullSync = localStorage.getItem(LAST_FULL_SYNC_KEY);
        const safeLastSync = sanitizeWatermark(storedLastSync);
        const incrementalJql = buildJql(safeLastSync);
        const fullJql = buildJql(null);
        const shouldFullSync =
          !safeLastSync || !isRecentIso(storedLastFullSync, FULL_SYNC_EVERY_MS);

        let merged = shouldFullSync
          ? []
          : hasHydratedCache
          ? issuesRef.current
          : [];
        let lastSeenUpdated = safeLastSync || new Date(0).toISOString();

        const fetchAllPages = async (jql: string) => {
          let token: string | null = null;
          let pages = 0;
          let loadedCount = 0;

          do {
            const { issues: pageIssues, paging } = await fetchPage(
              jql,
              token || undefined
            );

            const normalizedPage = normalizeIssues(pageIssues as Issue[]);
            loadedCount += normalizedPage.length;

            if (normalizedPage.length > 0) {
              merged = mergeIssues(merged, normalizedPage);
              setIssues(merged);
              setProgress({ loaded: merged.length });

              const pageMaxUpdated = normalizedPage
                .map((i) => i.updated || i.created)
                .filter(Boolean)
                .sort()
                .at(-1);

              if (pageMaxUpdated && pageMaxUpdated > lastSeenUpdated) {
                lastSeenUpdated = pageMaxUpdated;
              }
            }

            token = paging?.nextPageToken || null;
            pages++;
          } while (token && pages < MAX_PAGES && !signal.aborted);

          return loadedCount;
        };

        let loaded = 0;
        loaded = shouldFullSync
          ? await fetchAllPages(fullJql)
          : await fetchAllPages(incrementalJql);

        if (loaded === 0 && merged.length === 0 && safeLastSync) {
          localStorage.removeItem(LAST_SYNC_KEY);
          lastSeenUpdated = new Date(0).toISOString();
          await fetchAllPages(fullJql);
        }

        if (!signal.aborted) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
          localStorage.setItem(
            LAST_SYNC_KEY,
            lastSeenUpdated || new Date().toISOString()
          );
          if (shouldFullSync) {
            localStorage.setItem(LAST_FULL_SYNC_KEY, new Date().toISOString());
          }
          hasHydratedCache = true;
          setLoading(false);
        }
      } catch (e: any) {
        if (!signal.aborted) {
          setError(String(e.message || e));
          setLoading(false);
        }
      } finally {
        isRunning = false;
      }
    };

    const schedule = () => {
      const interval =
        document.visibilityState === "visible" ? ACTIVE_POLL_MS : HIDDEN_POLL_MS;
      pollTimer = setTimeout(async () => {
        await run();
        if (!signal.aborted) schedule();
      }, interval);
    };

    const triggerSoon = () => {
      const now = Date.now();
      if (now - lastTriggerAt < MIN_TRIGGER_GAP_MS) return;
      lastTriggerAt = now;
      run();
    };

    run();
    schedule();
    window.addEventListener("focus", triggerSoon);
    window.addEventListener("online", triggerSoon);
    document.addEventListener("visibilitychange", triggerSoon);

    return () => {
      if (pollTimer) window.clearTimeout(pollTimer);
      window.removeEventListener("focus", triggerSoon);
      window.removeEventListener("online", triggerSoon);
      document.removeEventListener("visibilitychange", triggerSoon);
      controller.abort();
    };
  }, [dateFrom, dateTo, fetchPage, setIssues]);

  return {
    issues,
    loadingInitial: loading,
    error,
    progress,
  };
}
