"use client";

import React, { useMemo, useState } from "react";
import "./sortFilter.css";
import ExportIssuesButton from "../ExportIssuesButton/ExportIssuesButton";
import { useJiraSearch } from "@/hooks/useJiraSearch";

type Props = {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onReset: () => void;
};

export function SortFilter({
  sort,
  onSortChange,
  dateFrom = "",
  dateTo = "",
  onDateChange,
  onReset,
}: Props) {
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);
  const { issues } = useJiraSearch();
  const handleDateChange = () => {
    onDateChange(from, to);
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    onReset();
  };

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

  return (
    <div className="sort-filter">
      <label className="sort-filter__label">Sort by date:</label>
      <select
        className="sort-filter__select"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as "newest" | "oldest")}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>

      <label>From:</label>
      <input
        className="sort-filter__input"
        type="date"
        value={dateFrom} // use dateFrom prop
        onChange={(e) => onDateChange(e.target.value, dateTo)} // dateTo prop
      />

      <label>To:</label>
      <input
        className="sort-filter__input"
        type="date"
        value={dateTo} // use dateTo prop
        onChange={(e) => onDateChange(dateFrom, e.target.value)} // dateFrom prop
      />
      <>
        <button className="sort-filter__reset" onClick={handleReset}>
          Reset filters
        </button>{" "}
        <ExportIssuesButton
          issues={filteredIssues.map((i) => ({
            ...i,
            remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
            issueType: i.issueType ?? "Task",
            project: i.project ?? "MECH",
            worklogs: i.worklogs ?? [],
          }))}
        />
      </>
    </div>
  );
}
