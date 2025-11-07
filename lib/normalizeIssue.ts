import type { Issue } from "@/lib/types";
import type { NormalizedIssue } from "@/lib/jira";

export function normalizeIssue(i: Issue): NormalizedIssue {
  return {
    ...i,
    remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
    issueType: i.issueType ?? "Task",
    project: i.project ?? "MECH",
    worklogs: i.worklogs ?? [],
    assignee: i.assignee ?? null,
    reporter: i.reporter ?? null,
    mechanicsRaw: Array.isArray(i.mechanicsRaw) ? i.mechanicsRaw : [],
    attachment: Array.isArray(i.attachment) ? i.attachment : [],
  };
}

export function normalizeIssues(list: Issue[]): NormalizedIssue[] {
  return list.map(normalizeIssue);
}
