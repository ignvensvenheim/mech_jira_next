"use client";

import React, { useState } from "react";
import "./sortFilter.css";

type Props = {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  dateFrom?: string;
  dateTo?: string;
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

  const handleDateChange = () => {
    onDateChange(from, to);
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    onReset();
  };

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

      <label className="sort-filter__label">From:</label>
      <input
        type="date"
        className="sort-filter__date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        onBlur={handleDateChange}
      />

      <label className="sort-filter__label">To:</label>
      <input
        type="date"
        className="sort-filter__date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        onBlur={handleDateChange}
      />

      <button className="sort-filter__reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
