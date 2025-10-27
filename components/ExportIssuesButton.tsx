"use client";

import * as XLSX from "xlsx";
import { ButtonHTMLAttributes } from "react";
import type { Issue } from "@/lib/types";

type Props = {
  issues: Issue[];
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function ExportIssuesButton({ issues, ...props }: Props) {
  function exportToExcel() {
    if (!issues?.length) return;

    // Convert issues to a flat table for Excel
    const rows = issues.map((i) => ({
      Key: i.key,
      Summary: i.summary,
      Status: i.status,
      Priority: i.priority,
      RequestType: i.requestType ?? "",
      Assignee: i.assignee?.name ?? "",
      Reporter: i.reporter?.name ?? "",
      Created: i.created,
      Updated: i.updated,
      TimeSpentSeconds: i.timeSpentSeconds,
      URL: i.requestUrl ?? "",
    }));

    // Generate worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Issues");

    // Trigger download
    XLSX.writeFile(workbook, "jira_issues.xlsx");
  }

  return (
    <button
      {...props}
      onClick={exportToExcel}
      className={`px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 ${
        props.className ?? ""
      }`}
    >
      Export to Excel
    </button>
  );
}
