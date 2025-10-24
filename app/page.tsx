"use client";

import React from "react";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { IssueCard } from "@/components/TicketCard/TicketCard";
import "./page.css";

export default function Page() {
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
    requestTypeOptions,
    assigneeOptions,
    loadMore,
    resetFilters,
  } = useJiraSearch();

  const isLoadMoreDisabled =
    !paging?.nextPageToken || paging?.isLast || loadingMore || !!error;

  return (
    <div className="page">
      {loadingInitial && <div className="page__loading">Loading…</div>}

      {error && !loadingInitial && (
        <div className="page__error">{String(error)}</div>
      )}

      <section className="page__issues">
        {issues.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </section>

      {!loadingInitial && !error && issues.length === 0 && (
        <div className="page__empty">No issues found.</div>
      )}

      <div className="page__load-more">
        <button
          onClick={loadMore}
          disabled={isLoadMoreDisabled}
          className={`page__load-more-button ${
            loadingMore ? "page__load-more-button--loading" : ""
          } ${
            isLoadMoreDisabled && !loadingMore
              ? "page__load-more-button--disabled"
              : ""
          }`}
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
