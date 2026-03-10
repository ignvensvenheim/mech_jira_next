"use client";
import "./exportIssuesButton.css";
import * as XLSX from "xlsx";
import { ButtonHTMLAttributes } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { Issue } from "@/lib/types";

type Props = {
  issues: Issue[];
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Convert seconds to an Excel time value (fraction of a day)
function secondsToExcelDays(seconds?: number): number {
  if (!seconds || seconds <= 0) return 0;
  return seconds / 86400;
}

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
      cell.z = format;
    }
  }
}

// extract subcategory
function extractBetweenPipes(summary: string = ""): string {
  const parts = summary.split("|").map((p) => p.trim());
  return parts.length >= 3 ? parts[1] : "";
}

export default function ExportIssuesButton({ issues, ...props }: Props) {
  const { t } = useI18n();
  const { disabled, className, ...buttonProps } = props;

  function exportToExcel() {
    if (!issues?.length) return;

    const rows = issues.map((i) => {
      const secs = i.timeSpentSeconds ?? 0;

      return {
        [t("home.exportKey")]: i.key,
        [t("home.exportSummary")]: i.summary,
        [t("home.exportStatus")]: i.status,
        [t("home.exportPriority")]: i.priority,
        [t("home.exportCategory")]: i.requestType ?? "",
        [t("home.exportSubcategory")]: extractBetweenPipes(i.summary),
        [t("home.exportReporter")]: i.reporter?.name ?? "",
        [t("home.exportMechanics")]: i.mechanics?.join(", ") ?? "",
        [t("home.exportCreated")]: i.created ? new Date(i.created) : "",
        [t("home.exportResolved")]: i.resolved ? new Date(i.resolved) : "",
        [t("home.exportTimeSpent")]: secondsToExcelDays(secs),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    setColumnNumberFormat(worksheet, t("home.exportCreated"), "yyyy-mm-dd hh:mm");
    setColumnNumberFormat(worksheet, t("home.exportResolved"), "yyyy-mm-dd hh:mm");
    setColumnNumberFormat(worksheet, t("home.exportTimeSpent"), "[h]:mm");

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t("home.exportSheet"));
    XLSX.writeFile(workbook, t("home.exportFile"));
  }

  return (
    <button
      {...buttonProps}
      disabled={disabled}
      aria-busy={disabled}
      onClick={exportToExcel}
      className={`export-button ${className ?? ""}`.trim()}
    >
      {disabled ? t("home.fetchingTickets") : t("home.exportToExcel")}
    </button>
  );
}
