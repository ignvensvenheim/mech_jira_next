"use client";

import React from "react";
import type { ApiResponse, Issue } from "@/lib/types";
import { useIssues } from "@/lib/IssuesContext";
import { normalizeIssues } from "@/lib/normalizeIssue";
import {
  buildJiraSyncJql,
  createEmptyJiraCacheMeta,
  JIRA_ACTIVE_POLL_MS,
  JIRA_ACTIVE_SWEEP_EVERY_MS,
  JIRA_ARCHIVE_SWEEP_EVERY_MS,
  JIRA_FULL_BASELINE_REFRESH_EVERY_MS,
  JIRA_HIDDEN_POLL_MS,
  JIRA_MAX_PAGES,
  JIRA_MIN_TRIGGER_GAP_MS,
  JIRA_PAGE_SIZE,
  JIRA_PROJECT_KEY,
  JIRA_RECENT_SWEEP_EVERY_MS,
  JIRA_SYNC_CACHE_VERSION,
  isRecentIso,
  mergeIssues,
  parseJiraCacheEnvelope,
  sanitizeWatermark,
  type JiraIssuesCacheEnvelope,
  type JiraIssuesCacheMeta,
} from "@/lib/jiraSync";
import type { NormalizedIssue } from "@/lib/jira";

const CACHE_KEY = "jiraIssuesCache";

function shouldRunSweep(lastRunAt: string | null, maxAgeMs: number) {
  return !isRecentIso(lastRunAt, maxAgeMs);
}

export function useJiraSearch(dateFrom?: string, dateTo?: string) {
  const [loading, setLoading] = React.useState(true);
  const [fetchingAllTickets, setFetchingAllTickets] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ loaded: number }>({
    loaded: 0,
  });
  const [fullRefreshNonce, setFullRefreshNonce] = React.useState(0);

  const { issues, setIssues } = useIssues();
  const issuesRef = React.useRef<NormalizedIssue[]>(issues);
  React.useEffect(() => {
    issuesRef.current = issues;
  }, [issues]);

  const hasScopedFilters = Boolean(dateFrom || dateTo);

  const fetchPage = React.useCallback(async (jql: string, token?: string) => {
    const params = new URLSearchParams();

    params.set("jql", jql);
    params.set("maxResults", JIRA_PAGE_SIZE.toString());
    params.set("profile", "list");
    if (token) params.set("nextPageToken", token);

    const response = await fetch(`/api/jira/search?${params}`, {
      cache: "no-store",
    });
    const json = (await response.json()) as ApiResponse;
    if (json.error) throw new Error(json.error);
    return json;
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let hasHydratedCache = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let isRunning = false;
    let lastTriggerAt = 0;
    let didRunInitialSync = false;
    let cacheEnvelope: JiraIssuesCacheEnvelope | null = null;

    const updateIssues = (nextIssues: NormalizedIssue[]) => {
      issuesRef.current = nextIssues;
      setIssues(nextIssues);
      setProgress({ loaded: nextIssues.length });
    };

    const persistCache = (nextIssues: NormalizedIssue[], meta: JiraIssuesCacheMeta) => {
      const envelope: JiraIssuesCacheEnvelope = {
        version: JIRA_SYNC_CACHE_VERSION,
        issues: nextIssues as Issue[],
        meta,
      };

      cacheEnvelope = envelope;
      localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
    };

    if (!hasScopedFilters) {
      try {
        cacheEnvelope = parseJiraCacheEnvelope(localStorage.getItem(CACHE_KEY));
        if (cacheEnvelope?.issues.length) {
          const cached = normalizeIssues(cacheEnvelope.issues);
          hasHydratedCache = cached.length > 0;
          if (cached.length > 0) {
            updateIssues(cached);
            setLoading(false);
          }
        }
      } catch {
        cacheEnvelope = null;
      }
    }

    const fetchAllPages = async (args: {
      jql: string;
      merged: NormalizedIssue[];
      applyAsAuthoritative?: boolean;
    }) => {
      let token: string | null = null;
      let pages = 0;
      let nextMerged = args.applyAsAuthoritative ? [] : args.merged;

      do {
        const { issues: pageIssues, paging } = await fetchPage(args.jql, token || undefined);
        const normalizedPage = normalizeIssues(pageIssues as Issue[]);

        if (normalizedPage.length > 0) {
          nextMerged = mergeIssues(nextMerged, normalizedPage);

          if (!signal.aborted) {
            updateIssues(nextMerged);
          }
        }

        token = paging?.nextPageToken || null;
        pages++;
      } while (token && pages < JIRA_MAX_PAGES && !signal.aborted);

      return nextMerged;
    };

    const runCachedSync = async (initialOnly: boolean, forceFullRefresh: boolean) => {
      const currentMeta = cacheEnvelope?.meta || createEmptyJiraCacheMeta();
      let merged = hasHydratedCache ? issuesRef.current : [];
      let meta = { ...currentMeta };
      const nowIso = new Date().toISOString();
      const safeWatermark = sanitizeWatermark(meta.lastSuccessfulSyncAt);

      const needsFullSeed =
        forceFullRefresh ||
        !cacheEnvelope ||
        cacheEnvelope.version !== JIRA_SYNC_CACHE_VERSION ||
        !meta.hasFullSnapshot ||
        !meta.lastSuccessfulSyncAt ||
        !safeWatermark ||
        !isRecentIso(meta.lastFullSyncAt, JIRA_FULL_BASELINE_REFRESH_EVERY_MS);

      if (needsFullSeed) {
        setFetchingAllTickets(true);
        merged = await fetchAllPages({
          jql: buildJiraSyncJql({
            mode: "full",
            projectKey: JIRA_PROJECT_KEY,
          }),
          merged: [],
          applyAsAuthoritative: true,
        });

        meta = {
          hasFullSnapshot: true,
          lastSuccessfulSyncAt: nowIso,
          lastFullSyncAt: nowIso,
          lastActiveSweepAt: nowIso,
          lastRecentSweepAt: nowIso,
          lastArchiveSweepAt: nowIso,
        };
        persistCache(merged, meta);
        hasHydratedCache = true;
        return;
      }

      if (safeWatermark) {
        merged = await fetchAllPages({
          jql: buildJiraSyncJql({
            mode: "delta",
            updatedSince: safeWatermark,
            projectKey: JIRA_PROJECT_KEY,
          }),
          merged,
        });

        meta.lastSuccessfulSyncAt = nowIso;
        persistCache(merged, meta);
      }

      hasHydratedCache = true;
      if (initialOnly) return;

      if (shouldRunSweep(meta.lastActiveSweepAt, JIRA_ACTIVE_SWEEP_EVERY_MS)) {
        merged = await fetchAllPages({
          jql: buildJiraSyncJql({
            mode: "active",
            projectKey: JIRA_PROJECT_KEY,
          }),
          merged,
        });
        meta.lastActiveSweepAt = new Date().toISOString();
        meta.lastSuccessfulSyncAt = meta.lastActiveSweepAt;
        persistCache(merged, meta);
      }

      if (shouldRunSweep(meta.lastRecentSweepAt, JIRA_RECENT_SWEEP_EVERY_MS)) {
        merged = await fetchAllPages({
          jql: buildJiraSyncJql({
            mode: "recent",
            projectKey: JIRA_PROJECT_KEY,
          }),
          merged,
        });
        meta.lastRecentSweepAt = new Date().toISOString();
        meta.lastSuccessfulSyncAt = meta.lastRecentSweepAt;
        persistCache(merged, meta);
      }

      if (shouldRunSweep(meta.lastArchiveSweepAt, JIRA_ARCHIVE_SWEEP_EVERY_MS)) {
        merged = await fetchAllPages({
          jql: buildJiraSyncJql({
            mode: "archive",
            projectKey: JIRA_PROJECT_KEY,
          }),
          merged,
        });
        meta.lastArchiveSweepAt = new Date().toISOString();
        meta.lastSuccessfulSyncAt = meta.lastArchiveSweepAt;
        persistCache(merged, meta);
      }
    };

    const runScopedSync = async () => {
      setFetchingAllTickets(true);
      const merged = await fetchAllPages({
        jql: buildJiraSyncJql({
          mode: "full",
          projectKey: JIRA_PROJECT_KEY,
          dateFrom,
          dateTo,
        }),
        merged: [],
        applyAsAuthoritative: true,
      });
      updateIssues(merged);
    };

    const run = async (options?: { forceFullRefresh?: boolean; initialOnly?: boolean }) => {
      if (isRunning) return;
      isRunning = true;

      try {
        if (!hasHydratedCache) setLoading(true);
        setError(null);

        if (hasScopedFilters) {
          await runScopedSync();
        } else {
          await runCachedSync(Boolean(options?.initialOnly), Boolean(options?.forceFullRefresh));
        }

        if (!signal.aborted) {
          setLoading(false);
        }
      } catch (e: any) {
        if (!signal.aborted) {
          setError(String(e.message || e));
          setLoading(false);
        }
      } finally {
        setFetchingAllTickets(false);
        isRunning = false;
      }
    };

    const schedule = () => {
      const interval =
        document.visibilityState === "visible" ? JIRA_ACTIVE_POLL_MS : JIRA_HIDDEN_POLL_MS;
      pollTimer = setTimeout(async () => {
        await run({ initialOnly: false });
        if (!signal.aborted) schedule();
      }, interval);
    };

    const triggerSoon = () => {
      const now = Date.now();
      if (now - lastTriggerAt < JIRA_MIN_TRIGGER_GAP_MS) return;
      lastTriggerAt = now;
      void run({ initialOnly: false });
    };

    void run({
      forceFullRefresh: fullRefreshNonce > 0,
      initialOnly: !didRunInitialSync,
    }).finally(() => {
      didRunInitialSync = true;
    });
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
  }, [dateFrom, dateTo, fetchPage, fullRefreshNonce, hasScopedFilters, setIssues]);

  const refreshAllTickets = React.useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setFullRefreshNonce((value) => value + 1);
  }, []);

  return {
    issues,
    loadingInitial: loading,
    fetchingAllTickets,
    error,
    progress,
    refreshAllTickets,
  };
}
