import { describe, expect, it, vi } from "vitest";
import {
  buildJiraSyncJql,
  createEmptyJiraCacheMeta,
  isArchivedIssue,
  mergeIssues,
  sanitizeWatermark,
} from "@/lib/jiraSync";
import type { NormalizedIssue } from "@/lib/jira";

function makeIssue(overrides: Partial<NormalizedIssue>): NormalizedIssue {
  return {
    id: "1",
    key: "MECH-1",
    summary: "Summary",
    status: "Done",
    statusCategory: "done",
    priority: null,
    assignee: null,
    reporter: null,
    creator: null,
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    resolved: "2026-01-01T00:00:00.000Z",
    timeSpentSeconds: 0,
    remainingEstimateSeconds: 0,
    issueType: "Task",
    project: "MECH",
    requestType: null,
    requestUrl: null,
    descriptionText: null,
    mechanics: [],
    mechanicsRaw: [],
    worklogs: [],
    comments: [],
    attachment: [],
    ...overrides,
  };
}

describe("jiraSync", () => {
  it("builds a delta JQL query from the updated watermark", () => {
    expect(
      buildJiraSyncJql({
        mode: "delta",
        updatedSince: "2026-06-01T10:45:00.000Z",
      }),
    ).toContain('updated >= "2026-06-01 10:45"');
  });

  it("builds a recent sweep query with a 14 day activity window", () => {
    expect(buildJiraSyncJql({ mode: "recent" })).toContain('updated >= "-14d"');
  });

  it("treats old done issues as archived", () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    expect(
      isArchivedIssue(
        makeIssue({
          updated: "2026-01-01T00:00:00.000Z",
          resolved: "2026-01-01T00:00:00.000Z",
        }),
        90,
        now,
      ),
    ).toBe(true);
  });

  it("keeps recently updated done issues out of archive", () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    expect(
      isArchivedIssue(
        makeIssue({
          updated: "2026-05-20T00:00:00.000Z",
          resolved: "2026-01-01T00:00:00.000Z",
        }),
        90,
        now,
      ),
    ).toBe(false);
  });

  it("merges updated issues by id and keeps newest sort order", () => {
    const merged = mergeIssues(
      [
        makeIssue({
          id: "1",
          key: "MECH-1",
          updated: "2026-05-01T00:00:00.000Z",
          summary: "Old",
        }),
      ],
      [
        makeIssue({
          id: "1",
          key: "MECH-1",
          updated: "2026-06-01T00:00:00.000Z",
          summary: "New",
        }),
        makeIssue({
          id: "2",
          key: "MECH-2",
          updated: "2026-05-15T00:00:00.000Z",
        }),
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].key).toBe("MECH-1");
    expect(merged[0].summary).toBe("New");
  });

  it("sanitizes watermarks with overlap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    expect(sanitizeWatermark("2026-06-01T11:00:00.000Z")).toBe(
      "2026-06-01T10:59:00.000Z",
    );
    vi.useRealTimers();
  });

  it("starts cache metadata without a full snapshot flag", () => {
    expect(createEmptyJiraCacheMeta().hasFullSnapshot).toBe(false);
  });
});
