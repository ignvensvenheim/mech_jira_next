"use client";

import "./sortFilter.css";
import ExportIssuesButton from "../ExportIssuesButton/ExportIssuesButton";
import { STATUS_OPTIONS } from "@/data/listData";
import { DEPARTMENT_LINES } from "@/data/listData";

type Props = {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onReset: () => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  selectedDepartment: string;
  onDepartmentChange: (dep: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  issues: any[];
  searchText: string;
  onSearchTextChange: (value: string) => void;
};

export function SortFilter({
  sort,
  onSortChange,
  dateFrom,
  dateTo,
  onDateChange,
  onReset,
  selectedStatuses,
  onStatusChange,
  selectedDepartment,
  onDepartmentChange,
  selectedLine,
  onLineChange,
  searchText,
  onSearchTextChange,
  issues = [],
}: Props) {
  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="sort-filter">
      <div className="sort-filter__controls">
        <div className="sort-filter__new-old">
          <label>Show:</label>
          <select
            className="sort-filter__pill"
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "newest" | "oldest")
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="sort-filter__date">
          <label>From:</label>
          <input
            className="sort-filter__pill"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateChange(e.target.value, dateTo)}
          />
          <label>To:</label>
          <input
            className="sort-filter__pill"
            type="date"
            value={dateTo}
            onChange={(e) => onDateChange(dateFrom, e.target.value)}
          />
        </div>
        <div className="sort-filter__status-pills">
          <label>Status:</label>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`sort-filter__pill ${
                selectedStatuses.includes(status)
                  ? "sort-filter__pill--active"
                  : ""
              }`}
              onClick={() => toggleStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="sort-filter__department-line">
          <label>Category:</label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">All</option>
            {Object.keys(DEPARTMENT_LINES).map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>

          <label>Sub. Category:</label>
          <select
            value={selectedLine}
            onChange={(e) => onLineChange(e.target.value)}
            disabled={!selectedDepartment}
          >
            <option value="">All</option>
            {(DEPARTMENT_LINES[selectedDepartment] || []).map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sort-filter__search">
        <label>Search:</label>
        <input
          className="sort-filter__pill"
          type="text"
          placeholder="search by text.."
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
        />
      </div>
      <div className="sort-filter__actions">
        <button className="sort-filter__reset" onClick={onReset}>
          Reset filters
        </button>
        <ExportIssuesButton
          issues={(issues ?? []).map((i) => ({
            ...i,
            remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
            issueType: i.issueType ?? "Task",
            project: i.project ?? "MECH",
            worklogs: i.worklogs ?? [],
          }))}
        />
      </div>
    </div>
  );
}
