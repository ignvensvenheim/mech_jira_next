import type { NormalizedIssue } from "@/lib/jira";

export function getIssueFilterOptions(
  issues: Pick<NormalizedIssue, "status">[],
  departmentLines: Record<string, string[]> = {}
) {
  const statuses = new Set<string>();
  for (const issue of issues) {
    if (issue.status?.trim()) statuses.add(issue.status);
  }

  return {
    statuses: [...statuses].sort((a, b) => a.localeCompare(b, "lt", { numeric: true })),
    departmentLines,
  };
}
