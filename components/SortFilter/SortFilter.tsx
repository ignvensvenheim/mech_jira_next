"use client";

import React, { useState } from "react";
import "./sortFilter.css";

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
      <label>From:</label>
      <input
        type="date"
        value={dateFrom} // use dateFrom prop
        onChange={(e) => onDateChange(e.target.value, dateTo)} // dateTo prop
      />

      <label>To:</label>
      <input
        type="date"
        value={dateTo} // use dateTo prop
        onChange={(e) => onDateChange(dateFrom, e.target.value)} // dateFrom prop
      />

      <button className="sort-filter__reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
