"use client";

import React from "react";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { IssueCard } from "@/components/TicketCard/TicketCard";
import ExportIssuesButton from "@/components/ExportIssuesButton";
import "./page.css";

export default function Page() {
  const { filters, setFilters, issues, loadingInitial, error, progress } =
    useJiraSearch();

  const ITEMS_PER_PAGE = 30;
  const [page, setPage] = React.useState(1);

  const totalPages = Math.ceil(issues.length / ITEMS_PER_PAGE);
  const visibleIssues = issues.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Reset page to 1 when filters change
  React.useEffect(() => setPage(1), [filters]);

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Issues</h1>
        <ExportIssuesButton issues={issues} />
      </div>

      {loadingInitial && (
        <div className="page__loading">
          Loading… {progress.loaded}
          {progress.total
            ? ` / ${progress.total} (${Math.round(
                (progress.loaded / progress.total) * 100
              )}%)`
            : ""}
        </div>
      )}

      {error && !loadingInitial && (
        <div className="page__error">{String(error)}</div>
      )}

      <section className="page__issues">
        {visibleIssues.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </section>

      {!loadingInitial && !error && issues.length === 0 && (
        <div className="page__empty">No issues found.</div>
      )}

      {issues.length > ITEMS_PER_PAGE && (
        <div className="page__pagination">
          <button
            className="page__pagination-button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            &lt; Prev
          </button>

          <div className="page__pagination-pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                className={`page__pagination-button ${
                  num === page ? "page__pagination-button--active" : ""
                }`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            className="page__pagination-button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next &gt;
          </button>
        </div>
      )}
    </div>
  );
}
