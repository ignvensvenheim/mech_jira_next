"use client";
import "./exportIssuesButton.css";
import * as XLSX from "xlsx";
import { ButtonHTMLAttributes } from "react";
import type { Issue } from "@/lib/types";

type Props = {
  issues: Issue[];
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Convert seconds to an Excel time value (fraction of a day)
function secondsToExcelDays(seconds?: number): number {
  if (!seconds || seconds <= 0) return 0;
  return seconds / 86400;
}

// Human-friendly string like "2d 3h 15m"
function humanizeSeconds(total?: number): string {
  if (!total || total <= 0) return "";
  let s = total;
  const days = Math.floor(s / 86400);
  s %= 86400;
  const hours = Math.floor(s / 3600);
  s %= 3600;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!days && !hours && !minutes && seconds) parts.push(`${seconds}s`);
  return parts.join(" ");
}

// Apply a number format to an entire column by header text
function setColumnNumberFormat(
  ws: XLSX.WorkSheet,
  headerText: string,
  format: string
) {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  let targetCol = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = ws[addr];
    if (cell && String(cell.v).trim() === headerText) {
      targetCol = c;
      break;
    }
  }
  if (targetCol === -1) return;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: targetCol });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = format; // e.g. "[h]:mm"
    }
  }
}

// Make a readable list from customfield_10267
function formatMechanics(value: unknown): string {
  if (!value) return "";
  const label = (u: any) =>
    typeof u === "string"
      ? u
      : u?.displayName || u?.name || u?.value || u?.label || "";

  if (Array.isArray(value)) {
    const names = value.map(label).filter(Boolean);
    // de-duplicate while preserving order
    const seen = new Set<string>();
    const unique = names.filter((n) =>
      seen.has(n) ? false : (seen.add(n), true)
    );
    return unique.join(", ");
  }

  if (typeof value === "object") {
    return label(value);
  }

  return String(value);
}

export default function ExportIssuesButton({ issues, ...props }: Props) {
  function exportToExcel() {
    if (!issues?.length) return;

    const rows = issues.map((i) => {
      const secs = i.timeSpentSeconds ?? 0;
      // const mechanics = formatMechanics((i as any)?.customfield_10267);

      return {
        Key: i.key,
        Summary: i.summary,
        Status: i.status,
        Priority: i.priority,
        Category: i.requestType ?? "",
        Assignee: i.assignee?.name ?? "",
        Reporter: i.reporter?.name ?? "",
        Created: i.created,
        Resolved: i.resolved,
        Mechanics: i.mechanics?.join(", ") ?? "",
        "Time Spent (h:mm)": secondsToExcelDays(secs), // sums correctly in Excel
        "Time Spent (pretty)": humanizeSeconds(secs), // human-readable
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    setColumnNumberFormat(worksheet, "Time Spent (h:mm)", "[h]:mm");

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Issues");
    XLSX.writeFile(workbook, "jira_issues.xlsx");
  }

  return (
    <button {...props} onClick={exportToExcel} className="export-button ">
      Export to Excel
    </button>
  );
}
