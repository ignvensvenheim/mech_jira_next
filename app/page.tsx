"use client";

import "./page.css";
import React, { useMemo, useState } from "react";
import type { Issue, NormalizedIssue } from "@/lib/types";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import ExportIssuesButton from "@/components/ExportIssuesButton/ExportIssuesButton";
import { Oval } from "react-loader-spinner";
import { SortFilter } from "@/components/SortFilter/SortFilter";
import { TicketsGrid } from "@/components/TicketsGrid/TicketsGrid";

export default function Page() {
  const { issues, loadingInitial, error, progress } = useJiraSearch();

  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // sort first
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const da = new Date(a.created).getTime();
      const db = new Date(b.created).getTime();
      return sort === "newest" ? db - da : da - db;
    });
  }, [issues, sort]);

  // filtered issues
  const filteredIssues = useMemo(() => {
    return sortedIssues.filter((i) => {
      const created = new Date(i.created).getTime();
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to = dateTo ? new Date(dateTo).getTime() : Infinity;
      return created >= from && created <= to;
    });
  }, [sortedIssues, dateFrom, dateTo]);

  // slice for current page
  const visibleIssues = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredIssues.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIssues, page]);

  // map Issue[] -> NormalizedIssue[]
  const normalizedVisibleIssues: NormalizedIssue[] = useMemo(() => {
    return visibleIssues.map((i) => ({
      ...i,
      remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
      issueType: i.issueType ?? "Task",
      project: i.project ?? "MECH",
      worklogs: i.worklogs ?? [],
    }));
  }, [visibleIssues]);

  // calculate total pages based on filtered issues
  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Issues filtering & export</h1>
        <ExportIssuesButton
          issues={filteredIssues.map((i) => ({
            ...i,
            remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
            issueType: i.issueType ?? "Task",
            project: i.project ?? "MECH",
            worklogs: i.worklogs ?? [],
          }))}
        />
      </div>

      <SortFilter
        sort={sort}
        onSortChange={setSort}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
          setPage(1); // reset to first page when filter changes
        }}
        onReset={() => {
          setSort("newest");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
      />

      {/* tickets grid */}
      <TicketsGrid issues={normalizedVisibleIssues} />

      {/* error */}
      {error && !loadingInitial && (
        <div className="page__error">{String(error)}</div>
      )}

      {/* empty state */}
      {!loadingInitial && !error && issues.length === 0 && (
        <div className="page__empty">No issues found.</div>
      )}

      {/* loader */}
      {loadingInitial && (
        <div className="page__loading">
          <Oval
            visible={true}
            height="80"
            width="80"
            color="#4fa94d"
            ariaLabel="oval-loading"
          />
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
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
