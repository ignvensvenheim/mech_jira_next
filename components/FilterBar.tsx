"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { Filters } from "@/lib/types";
import { DropdownMulti } from "@/components/DropdownMulti";

type AssigneeOption = { id: string; name: string };

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  statusOptions: string[];
  priorityOptions: string[];
  requestTypeOptions: string[];
  assigneeOptions: AssigneeOption[];
  onReset: () => void;
};

export function FilterBar({
  filters,
  setFilters,
  statusOptions,
  priorityOptions,
  requestTypeOptions,
  assigneeOptions,
  onReset,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const activeCount =
    (filters.assignee ? 1 : 0) +
    filters.requestTypes.length +
    filters.statuses.length +
    filters.priorities.length +
    (filters.createdFrom ? 1 : 0) +
    (filters.createdTo ? 1 : 0);

  return (
    <section
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "white",
        padding: 4,
        borderBottom: "1px solid #EBECF0",
      }}
    >
      {/* Toolbar (search on the right) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Filters button (popup anchors under this) */}
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Filters"
          style={iconBtnStyle}
        >
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>

        {/* Sort with arrows */}
        <select
          value={filters.orderBy}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              orderBy: e.target.value as Filters["orderBy"],
            }))
          }
          title="Sort"
          style={selectStyle}
        >
          <option value="created desc">Created ↓</option>
          <option value="created asc">Created ↑</option>
          <option value="updated desc">Updated ↓</option>
          <option value="updated asc">Updated ↑</option>
        </select>

        {/* Page size */}
        <select
          value={
            filters.maxResults === "all" ? "all" : String(filters.maxResults)
          }
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              maxResults:
                e.target.value === "all" ? "all" : Number(e.target.value),
            }))
          }
          title="Page size"
          style={{ ...selectStyle, width: 96 }}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              Size {n}
            </option>
          ))}
          <option value="all">All</option>
        </select>

        {/* Search on far right */}
        <input
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
          placeholder="Search…"
          title="Search summary/description/comment"
          style={textInputStyle}
        />
      </div>

      {open && (
        <PopoverPortal anchorEl={btnRef.current} onClose={() => setOpen(false)}>
          {/* X close button (top-right) */}
          <button
            aria-label="Close filters"
            title="Close"
            onClick={() => setOpen(false)}
            style={closeXStyle}
          >
            ×
          </button>

          <div style={grid}>
            <label style={labelRow}>
              <span style={labelText}>Assignee</span>
              <select
                value={filters.assignee}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, assignee: e.target.value }))
                }
                style={field}
              >
                <option value="">Any</option>
                <option value="me">Me</option>
                <option value="unassigned">Unassigned</option>
                {assigneeOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={labelRow}>
              <span style={labelText}>Requested</span>
              <div style={{ width: "100%" }}>
                <DropdownMulti
                  label=""
                  options={requestTypeOptions}
                  value={filters.requestTypes}
                  onChange={(next) =>
                    setFilters((f) => ({ ...f, requestTypes: next }))
                  }
                />
              </div>
            </div>

            <div style={labelRow}>
              <span style={labelText}>Status</span>
              <div style={{ width: "100%" }}>
                <DropdownMulti
                  label=""
                  options={statusOptions}
                  value={filters.statuses}
                  onChange={(next) =>
                    setFilters((f) => ({ ...f, statuses: next }))
                  }
                />
              </div>
            </div>

            <div style={labelRow}>
              <span style={labelText}>Priority</span>
              <div style={{ width: "100%" }}>
                <DropdownMulti
                  label=""
                  options={priorityOptions}
                  value={filters.priorities}
                  onChange={(next) =>
                    setFilters((f) => ({ ...f, priorities: next }))
                  }
                />
              </div>
            </div>

            <label style={labelRow}>
              <span style={labelText}>From</span>
              <input
                type="date"
                value={filters.createdFrom}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, createdFrom: e.target.value }))
                }
                style={field}
              />
            </label>

            <label style={labelRow}>
              <span style={labelText}>To</span>
              <input
                type="date"
                value={filters.createdTo}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, createdTo: e.target.value }))
                }
                style={field}
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <button
              onClick={() => {
                onReset();
              }}
              style={ghostBtn}
            >
              Reset
            </button>
          </div>
        </PopoverPortal>
      )}
    </section>
  );
}

/**
 * PopoverPortal: body portal, positioned under the anchor element (left-aligned).
 * Closes on outside click or Escape. Repositions on scroll/resize.
 */
function PopoverPortal({
  anchorEl,
  onClose,
  children,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    const el = document.createElement("div");
    containerRef.current = el;
    document.body.appendChild(el);
    setMounted(true);

    const reposition = () => {
      const maxWidth = Math.min(560, window.innerWidth - 16);
      if (!anchorEl) {
        // fallback position (top-left padding)
        setStyle({
          position: "fixed",
          top: 46,
          left: 8,
          zIndex: 10000,
          width: maxWidth,
          background: "#fff",
          border: "1px solid #DFE1E6",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(9,30,66,0.15)",
          padding: 8,
          overflow: "visible",
        });
        return;
      }
      const r = anchorEl.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(r.left, window.innerWidth - maxWidth - 8)
      );
      const top = r.bottom + 6;
      setStyle({
        position: "fixed",
        top,
        left,
        zIndex: 10000,
        width: maxWidth,
        background: "#fff",
        border: "1px solid #DFE1E6",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(9,30,66,0.15)",
        padding: 8,
        overflow: "visible",
      });
    };

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const cont = containerRef.current;
      if (!cont) return;
      if (!cont.contains(t) && !(anchorEl && anchorEl.contains(t))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    reposition();
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true });
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
      if (containerRef.current) document.body.removeChild(containerRef.current);
    };
  }, [anchorEl, onClose]);

  if (!mounted || !containerRef.current) return null;

  return createPortal(
    <div style={style}>{children}</div>,
    containerRef.current
  );
}

/* Styles */
const iconBtnStyle: React.CSSProperties = {
  height: 28,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  background: "white",
  color: "#172B4D",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  height: 28,
  padding: "3px 6px",
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  fontSize: 12.5,
  background: "#FFFFFF",
  color: "#172B4D",
};

const textInputStyle: React.CSSProperties = {
  marginLeft: "auto",
  flex: "0 1 320px",
  maxWidth: 380,
  height: 28,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  outline: "none",
  fontSize: 12.5,
  color: "#172B4D",
  background: "#FFFFFF",
  lineHeight: 1.1,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
  alignItems: "center",
};

const labelRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px 1fr",
  alignItems: "center",
  gap: 6,
};

const labelText: React.CSSProperties = {
  color: "#5E6C84",
  fontSize: 12.5,
  fontWeight: 600,
};

const field: React.CSSProperties = {
  width: "100%",
  height: 28,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  fontSize: 12.5,
  background: "#FFFFFF",
  color: "#172B4D",
};

const ghostBtn: React.CSSProperties = {
  padding: "4px 8px",
  height: 28,
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  background: "white",
  color: "#172B4D",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 600,
};

const closeXStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 24,
  height: 24,
  lineHeight: "20px",
  textAlign: "center" as const,
  borderRadius: 6,
  border: "1px solid #DFE1E6",
  background: "#FFFFFF",
  color: "#172B4D",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
