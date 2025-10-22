"use client";

import React from "react";

type Props = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  minMenuWidth?: number; // default 220
};

export function DropdownMulti({
  label,
  options,
  value,
  onChange,
  minMenuWidth = 220,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [menuWidth, setMenuWidth] = React.useState<number>(minMenuWidth);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  React.useEffect(() => {
    if (!open || !rootRef.current) return;
    const w = rootRef.current.getBoundingClientRect().width;
    setMenuWidth(Math.max(minMenuWidth, Math.floor(w)));
  }, [open, minMenuWidth]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  const clear = () => onChange([]);
  const selectAll = () => onChange([...options]);

  const summary =
    value.length === 0
      ? "Any"
      : value.length === 1
      ? value[0]
      : `${value.length} selected`;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label ? `${label}: ${summary}` : summary}
        aria-expanded={open}
        style={{
          width: "100%",
          height: 28,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid #DFE1E6",
          background: "#FFFFFF",
          color: "#172B4D",
          display: "inline-flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          lineHeight: 1.1,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label ? `${label}: ` : ""}
          {summary}
        </span>
        <span style={{ fontSize: 10, color: "#6B778C" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 1000, // ensure on top of the popover
            width: menuWidth,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: 300,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #EBECF0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(9,30,66,0.15)",
            padding: 6,
          }}
        >
          {/* Search */}
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid #DFE1E6",
                borderRadius: 6,
                fontSize: 12.5,
                color: "#172B4D",
              }}
            />
          </div>

          {/* All / Clear below search */}
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              onClick={selectAll}
              style={miniBtn()}
              title="Select all"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clear}
              style={miniBtn()}
              title="Clear"
            >
              Clear
            </button>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gap: 4 }}>
            {filtered.length === 0 ? (
              <div style={{ color: "#97A0AF", padding: "2px 2px" }}>
                No options
              </div>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(opt)}
                    onChange={() => toggle(opt)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12.5, color: "#172B4D" }}>
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function miniBtn(): React.CSSProperties {
  return {
    padding: "4px 8px",
    border: "1px solid #DFE1E6",
    borderRadius: 6,
    background: "#FAFBFC",
    color: "#172B4D",
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
