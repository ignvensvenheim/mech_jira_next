"use client";

import "./page.css";
import React, { useMemo, useState } from "react";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { Oval } from "react-loader-spinner";
import { SortFilter } from "@/components/SortFilter/SortFilter";
import { TicketsGrid } from "@/components/TicketsGrid/TicketsGrid";
import { useIssues } from "@/lib/IssuesContext";

export default function Page() {
  const { loadingInitial, error } = useJiraSearch();
  const { issues } = useIssues();

  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [searchText, setSearchText] = useState("");

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
    const search = searchText.trim().toLowerCase();

    return sortedIssues.filter((i) => {
      const matchesText =
        !search ||
        Object.values(i)
          .filter((v) => v != null)
          .some((v) => String(v).toLowerCase().includes(search));

      if (!matchesText) return false;

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
    searchText,
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

  return (
    <div className="page">
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
        onReset={() => {
          setSort("newest");
          setDateFrom("");
          setDateTo("");
          setSelectedStatuses([]);
          setSelectedDepartment("");
          setSelectedLine("");
          setSearchText("");
          setPage(1);
        }}
        issues={filteredIssues}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />

      <TicketsGrid issues={visibleIssues} />

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
