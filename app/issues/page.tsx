"use client";

import React from "react";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { FilterBar } from "@/components/FilterBar";
import { IssueCard } from "@/components/IssueCard";

export default function IssuesPage() {
  const {
    filters,
    setFilters,
    issues,
    paging,
    loadingInitial,
    loadingMore,
    error,
    statusOptions,
    priorityOptions,
    assigneeOptions,
    loadMore,
    resetFilters,
  } = useJiraSearch();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        assigneeOptions={assigneeOptions}
        onReset={resetFilters}
      />

      {loadingInitial && <div>Loading…</div>}
      {error && !loadingInitial && (
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
          Failed to load: {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {issues.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </section>

      {!loadingInitial && !error && issues.length === 0 && (
        <div style={{ color: "#97A0AF" }}>No issues found.</div>
      )}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={loadMore}
          disabled={
            !paging?.nextPageToken || paging?.isLast || loadingMore || !!error
          }
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #DFE1E6",
            background: loadingMore ? "#F4F5F7" : "white",
            cursor:
              !paging?.nextPageToken || paging?.isLast || loadingMore || !!error
                ? "not-allowed"
                : "pointer",
          }}
        >
          {loadingMore
            ? "Loading…"
            : paging?.isLast
            ? "No more results"
            : "Load more"}
        </button>
      </div>
    </div>
  );
}
