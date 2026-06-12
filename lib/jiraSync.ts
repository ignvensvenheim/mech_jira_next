import type { NormalizedIssue } from "@/lib/jira";
import type { Issue } from "@/lib/types";

export const JIRA_SYNC_CACHE_VERSION = 2;
export const JIRA_PROJECT_KEY = "MECH";
export const JIRA_PAGE_SIZE = 100;
export const JIRA_MAX_PAGES = 50;
export const JIRA_MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000;
export const JIRA_WATERMARK_OVERLAP_MS = 60 * 1000;
export const JIRA_ACTIVE_POLL_MS = 30 * 1000;
export const JIRA_HIDDEN_POLL_MS = 5 * 60 * 1000;
export const JIRA_MIN_TRIGGER_GAP_MS = 2 * 1000;
export const JIRA_ACTIVE_SWEEP_EVERY_MS = 5 * 60 * 1000;
export const JIRA_RECENT_SWEEP_EVERY_MS = 30 * 60 * 1000;
export const JIRA_ARCHIVE_SWEEP_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
export const JIRA_FULL_BASELINE_REFRESH_EVERY_MS = 3 * 24 * 60 * 60 * 1000;
export const JIRA_ARCHIVE_THRESHOLD_DAYS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_JIRA_ARCHIVE_THRESHOLD_DAYS,
  90
);
export const JIRA_RECENT_ACTIVITY_WINDOW_DAYS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_JIRA_RECENT_ACTIVITY_WINDOW_DAYS,
  14
);

export type JiraSyncMode = "full" | "delta" | "active" | "recent" | "archive";

export type JiraIssuesCacheMeta = {
  hasFullSnapshot: boolean;
  lastSuccessfulSyncAt: string | null;
  lastFullSyncAt: string | null;
  lastActiveSweepAt: string | null;
  lastRecentSweepAt: string | null;
  lastArchiveSweepAt: string | null;
};

export type JiraIssuesCacheEnvelope = {
  version: number;
  issues: Issue[];
  meta: JiraIssuesCacheMeta;
};

function parsePositiveInteger(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getIssueActivityTimestamp(
  issue: Pick<Issue, "updated" | "created"> & Partial<Pick<Issue, "resolved">>
) {
  const candidates = [issue.updated, issue.resolved, issue.created]
    .map((value) => Date.parse(String(value || "")))
    .filter((value) => !Number.isNaN(value));

  return candidates.length > 0 ? Math.max(...candidates) : Number.NaN;
}

function isDoneStatusCategory(statusCategory: string | undefined) {
  return String(statusCategory || "").trim().toLowerCase() === "done";
}

export function createEmptyJiraCacheMeta(): JiraIssuesCacheMeta {
  return {
    hasFullSnapshot: false,
    lastSuccessfulSyncAt: null,
    lastFullSyncAt: null,
    lastActiveSweepAt: null,
    lastRecentSweepAt: null,
    lastArchiveSweepAt: null,
  };
}

export function byUpdatedDesc(a: NormalizedIssue, b: NormalizedIssue) {
  return (
    new Date(b.updated || b.created).getTime() -
    new Date(a.updated || a.created).getTime()
  );
}

export function mergeIssues(
  existing: NormalizedIssue[],
  incoming: NormalizedIssue[]
): NormalizedIssue[] {
  const byId = new Map<string, NormalizedIssue>();
  for (const issue of existing) byId.set(issue.id, issue);
  for (const issue of incoming) byId.set(issue.id, issue);
  return [...byId.values()].sort(byUpdatedDesc);
}

export function sanitizeWatermark(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  if (parsed > Date.now() + JIRA_MAX_FUTURE_DRIFT_MS) return null;
  return new Date(Math.max(0, parsed - JIRA_WATERMARK_OVERLAP_MS)).toISOString();
}

export function isRecentIso(raw: string | null, maxAgeMs: number): boolean {
  if (!raw) return false;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= maxAgeMs;
}

export function isArchivedIssue(
  issue: Pick<Issue, "statusCategory" | "updated" | "created"> &
    Partial<Pick<Issue, "resolved">>,
  archiveThresholdDays: number = JIRA_ARCHIVE_THRESHOLD_DAYS,
  nowMs: number = Date.now()
) {
  if (!isDoneStatusCategory(issue.statusCategory)) {
    return false;
  }

  const activityTime = getIssueActivityTimestamp(issue);
  if (Number.isNaN(activityTime)) {
    return false;
  }

  return nowMs - activityTime >= archiveThresholdDays * 24 * 60 * 60 * 1000;
}

function formatJqlTimestamp(raw: string) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hours = String(parsed.getUTCHours()).padStart(2, "0");
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function buildJiraSyncJql(args: {
  mode: JiraSyncMode;
  updatedSince?: string | null;
  dateFrom?: string;
  dateTo?: string;
  projectKey?: string;
  archiveThresholdDays?: number;
  recentActivityWindowDays?: number;
}) {
  const projectKey = args.projectKey || JIRA_PROJECT_KEY;
  const archiveThresholdDays =
    args.archiveThresholdDays || JIRA_ARCHIVE_THRESHOLD_DAYS;
  const recentActivityWindowDays =
    args.recentActivityWindowDays || JIRA_RECENT_ACTIVITY_WINDOW_DAYS;
  const clauses: string[] = [`project = ${projectKey}`];

  if (args.dateFrom) clauses.push(`created >= "${args.dateFrom}"`);
  if (args.dateTo) clauses.push(`created <= "${args.dateTo}"`);

  switch (args.mode) {
    case "delta":
      if (args.updatedSince) {
        clauses.push(`updated >= "${formatJqlTimestamp(args.updatedSince)}"`);
      }
      break;
    case "active":
      clauses.push("statusCategory != Done");
      break;
    case "recent":
      clauses.push(`updated >= "-${recentActivityWindowDays}d"`);
      break;
    case "archive":
      clauses.push("statusCategory = Done");
      clauses.push(`updated < "-${archiveThresholdDays}d"`);
      break;
    case "full":
    default:
      break;
  }

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

export function parseJiraCacheEnvelope(raw: string | null): JiraIssuesCacheEnvelope | null {
  if (!raw) return null;

  const parsed = JSON.parse(raw) as JiraIssuesCacheEnvelope | Issue[];

  if (Array.isArray(parsed)) {
    return {
      version: 1,
      issues: parsed,
      meta: createEmptyJiraCacheMeta(),
    };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.issues) ||
    !parsed.meta ||
    typeof parsed.meta !== "object"
  ) {
    return null;
  }

  return {
    version: Number(parsed.version || 0),
    issues: parsed.issues,
    meta: {
      ...createEmptyJiraCacheMeta(),
      ...parsed.meta,
    },
  };
}
