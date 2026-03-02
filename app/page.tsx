"use client";

import "./page.css";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { Oval } from "react-loader-spinner";
import { SortFilter } from "@/components/SortFilter/SortFilter";
import { TicketsGrid } from "@/components/TicketsGrid/TicketsGrid";
import { useIssues } from "@/lib/IssuesContext";
import { NormalizedIssue } from "@/lib/jira";
import TicketModal from "@/components/TicketModal/TicketModal";

export default function Page() {
  const { loadingInitial, fetchingAllTickets, error } = useJiraSearch();
  const { issues } = useIssues();

  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<NormalizedIssue | null>(
    null,
  );

  // Sort issues
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const da = new Date(a.created).getTime();
      const db = new Date(b.created).getTime();
      return sort === "newest" ? db - da : da - db;
    });
  }, [issues, sort]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return sortedIssues.filter((i) => {
      const [depPart = "", linePart = ""] = (i.summary ?? "")
        .split("|")
        .map((s: string) => s.trim().toLowerCase());
      const dep = selectedDepartment.toLowerCase();
      const lin = selectedLine.toLowerCase();
      const matchDepartment = !selectedDepartment || depPart === dep;
      const matchLine = !selectedLine || linePart === lin;

      const created = new Date(i.created).getTime();
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to = dateTo ? new Date(dateTo).getTime() : Infinity;
      const matchDate = created >= from && created <= to;

      const matchStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(i.status ?? "");

      return matchDepartment && matchLine && matchDate && matchStatus;
    });
  }, [
    sortedIssues,
    selectedDepartment,
    selectedLine,
    selectedStatuses,
    dateFrom,
    dateTo,
  ]);

  const visibleIssues = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredIssues.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIssues, page]);

  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);
  const paginationItems = useMemo<(number | string)[]>(() => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }, [totalPages]);

  return (
    <div className="page">
      <div className="page__layout">
        <aside className="page__sidebar">
          <SortFilter
            sort={sort}
            onSortChange={setSort}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
              setPage(1);
            }}
            selectedStatuses={selectedStatuses}
            onStatusChange={(statuses) => {
              setSelectedStatuses(statuses);
              setPage(1);
            }}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={(dep) => {
              setSelectedDepartment(dep);
              setPage(1);
            }}
            selectedLine={selectedLine}
            onLineChange={(line) => {
              setSelectedLine(line);
              setPage(1);
            }}
            isLoadingTickets={loadingInitial || fetchingAllTickets}
            resultCount={filteredIssues.length}
            onReset={() => {
              setSort("newest");
              setDateFrom("");
              setDateTo("");
              setSelectedStatuses([]);
              setSelectedDepartment("");
              setSelectedLine("");
              setPage(1);
            }}
            issues={filteredIssues}
          />
          <Link className="page__sidebar-login" href="/login">
            Admin Login
          </Link>
        </aside>

        <section className="page__content">
          <TicketsGrid issues={visibleIssues} onOpen={setSelectedIssue} />

          <TicketModal
            isOpen={!!selectedIssue}
            onClose={() => setSelectedIssue(null)}
            issue={selectedIssue}
          />

          {error && !loadingInitial && (
            <div className="page__error">{String(error)}</div>
          )}

          {loadingInitial && (
            <div className="page__loading">
              <Oval visible={true} height={80} width={80} color="#4fa94d" />
            </div>
          )}

          {totalPages > 1 && (
            <div className="page__pagination">
              <button
                className="page__pagination-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                &lt;
              </button>

              <div className="page__pagination-pages">
                {paginationItems.map((item, index) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      className={`page__pagination-button ${
                        item === page ? "page__pagination-button--active" : ""
                      }`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={`${item}-${index}`} className="page__pagination-ellipsis">
                      ...
                    </span>
                  ),
                )}
              </div>

              <button
                className="page__pagination-button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                &gt;
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
