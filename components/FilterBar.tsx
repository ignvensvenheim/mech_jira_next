"use client";

import React from "react";
import type { Filters } from "@/lib/types";

type AssigneeOption = { id: string; name: string };

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  statusOptions: string[];
  priorityOptions: string[];
  assigneeOptions: AssigneeOption[];
  onReset: () => void;
};

export function FilterBar({
  filters,
  setFilters,
  statusOptions,
  priorityOptions,
  assigneeOptions,
  onReset,
}: Props) {
  return (
    <section
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "white",
        padding: 12,
        border: "1px solid #EBECF0",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(9,30,66,0.1)",
        display: "grid",
        gap: 8,
      }}
    >
      {/* Row 1 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={filters.project}
          onChange={(e) =>
            setFilters((f) => ({ ...f, project: e.target.value.toUpperCase() }))
          }
          placeholder="Project (e.g., MECH)"
          style={inputStyle(120)}
        />
        <input
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
          placeholder="Search summary/description/comment…"
          style={inputStyle(320)}
        />
        <select
          value={filters.assignee}
          onChange={(e) =>
            setFilters((f) => ({ ...f, assignee: e.target.value }))
          }
          style={inputStyle(180)}
          title="Assignee"
        >
          <option value="">Assignee: Any</option>
          <option value="me">Assignee: Me</option>
          <option value="unassigned">Assignee: Unassigned</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>
              Assignee: {a.name}
            </option>
          ))}
        </select>
        <select
          value={filters.orderBy}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              orderBy: e.target.value as Filters["orderBy"],
            }))
          }
          style={inputStyle(150)}
          title="Sort"
        >
          <option value="created desc">Sort: Created ↓</option>
          <option value="created asc">Sort: Created ↑</option>
          <option value="updated desc">Sort: Updated ↓</option>
          <option value="updated asc">Sort: Updated ↑</option>
        </select>

        {/* Compact Size + Reset on the right */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#42526E",
            }}
          >
            Size
            <select
              value={
                filters.maxResults === "all"
                  ? "all"
                  : String(filters.maxResults)
              }
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxResults:
                    e.target.value === "all" ? "all" : Number(e.target.value),
                }))
              }
              style={inputStyle(100)}
              title="Results per page"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="all">All (auto)</option>
            </select>
          </label>
          <button onClick={onReset} style={ghostBtn()}>
            Reset
          </button>
        </div>
      </div>

      {/* Row 2 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          color: "#42526E",
        }}
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          From
          <input
            type="date"
            value={filters.createdFrom}
            onChange={(e) =>
              setFilters((f) => ({ ...f, createdFrom: e.target.value }))
            }
            style={inputStyle(160)}
          />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          To
          <input
            type="date"
            value={filters.createdTo}
            onChange={(e) =>
              setFilters((f) => ({ ...f, createdTo: e.target.value }))
            }
            style={inputStyle(160)}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Status:</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statusOptions.length === 0 ? (
              <span style={{ color: "#97A0AF" }}>No statuses yet</span>
            ) : (
              statusOptions.map((s) => (
                <label key={s} style={checkLabel()}>
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(s)}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        statuses: e.target.checked
                          ? [...f.statuses, s]
                          : f.statuses.filter((x) => x !== s),
                      }))
                    }
                  />
                  {s}
                </label>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Priority:</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {priorityOptions.length === 0 ? (
              <span style={{ color: "#97A0AF" }}>No priorities yet</span>
            ) : (
              priorityOptions.map((p) => (
                <label key={p} style={checkLabel()}>
                  <input
                    type="checkbox"
                    checked={filters.priorities.includes(p)}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        priorities: e.target.checked
                          ? [...f.priorities, p]
                          : f.priorities.filter((x) => x !== p),
                      }))
                    }
                  />
                  {p}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function inputStyle(w?: number): React.CSSProperties {
  return {
    width: w ? w : undefined,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #DFE1E6",
    outline: "none",
    fontSize: 14,
    color: "#172B4D",
    background: "#FFFFFF",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #DFE1E6",
    background: "white",
    color: "#172B4D",
    cursor: "pointer",
    fontWeight: 600,
  };
}
function checkLabel(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    border: "1px solid #EBECF0",
    borderRadius: 999,
    background: "#FAFBFC",
  };
}
