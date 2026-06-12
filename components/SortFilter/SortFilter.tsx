"use client";

import "./sortFilter.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import ExportIssuesButton from "../ExportIssuesButton/ExportIssuesButton";
import { STATUS_OPTIONS } from "@/data/listData";
import { VISIBLE_DEPARTMENT_LINES } from "@/lib/machineCatalog";

type Props = {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  viewMode: "grid" | "list";
  onViewModeChange: (view: "grid" | "list") => void;
  searchText: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onReset: () => void;
  onFullRefreshTickets?: () => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  selectedDepartment: string;
  onDepartmentChange: (dep: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  isLoadingTickets?: boolean;
  isFullRefreshDisabled?: boolean;
  resultCount: number;
  issues: any[];
};

export function SortFilter({
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  searchText,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateChange,
  onReset,
  onFullRefreshTickets,
  selectedStatuses,
  onStatusChange,
  selectedDepartment,
  onDepartmentChange,
  selectedLine,
  onLineChange,
  isLoadingTickets = false,
  isFullRefreshDisabled = false,
  resultCount,
  issues = [],
}: Props) {
  const { t } = useI18n();
  const [isAdminSession, setIsAdminSession] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          user?: {
            role?: string | null;
            name?: string | null;
            email?: string | null;
          };
        };

        const normalizedRole = String(data.user?.role || "").trim().toUpperCase();
        const normalizedName = String(data.user?.name || "").trim().toLowerCase();
        const normalizedEmail = String(data.user?.email || "").trim().toLowerCase();
        const emailLocalPart = normalizedEmail.includes("@")
          ? normalizedEmail.split("@")[0]
          : normalizedEmail;

        if (!isCancelled) {
          setIsAdminSession(
            normalizedRole === "ADMIN" ||
              normalizedName === "ignven" ||
              emailLocalPart === "ignven"
          );
        }
      } catch {
        if (!isCancelled) {
          setIsAdminSession(false);
        }
      }
    };

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="sort-filter">
      <div className="sort-filter__topbar">
        <div className="sort-filter__count">
          {t("home.showingTickets", { count: resultCount })}
        </div>
        <div className="page__view-toggle" aria-label={t("home.view")}>
          <button
            type="button"
            className={`page__view-button${
              viewMode === "grid" ? " page__view-button--active" : ""
            }`}
            onClick={() => onViewModeChange("grid")}
            aria-label={t("common.grid")}
            title={t("common.grid")}
          >
            <span className="page__view-icon page__view-icon--grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>
          <button
            type="button"
            className={`page__view-button${
              viewMode === "list" ? " page__view-button--active" : ""
            }`}
            onClick={() => onViewModeChange("list")}
            aria-label={t("common.list")}
            title={t("common.list")}
          >
            <span className="page__view-icon page__view-icon--list" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div className="sort-filter__controls">
        <div className="sort-filter__new-old">
          <label>{t("home.sort")}</label>
          <select
            className="sort-filter__pill"
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "newest" | "oldest")
            }
          >
            <option value="newest">{t("home.newestFirst")}</option>
            <option value="oldest">{t("home.oldestFirst")}</option>
          </select>
        </div>
        <div className="sort-filter__search">
          <label>{t("home.search")}</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("home.searchPlaceholder")}
          />
        </div>
        <div className="sort-filter__date">
          <div className="sort-filter__date-grid">
            <div className="sort-filter__date-field">
              <label>{t("common.dateFrom")}:</label>
              <input
                className="sort-filter__pill"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateChange(e.target.value, dateTo)}
              />
            </div>
            <div className="sort-filter__date-field">
              <label>{t("common.dateTo")}:</label>
              <input
                className="sort-filter__pill"
                type="date"
                value={dateTo}
                onChange={(e) => onDateChange(dateFrom, e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="sort-filter__department-line">
          <label>{t("home.category")}</label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {Object.keys(VISIBLE_DEPARTMENT_LINES).map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>

          <label>{t("home.subcategory")}</label>
          <select
            value={selectedLine}
            onChange={(e) => onLineChange(e.target.value)}
            disabled={!selectedDepartment}
          >
            <option value="">{t("common.all")}</option>
            {(VISIBLE_DEPARTMENT_LINES[selectedDepartment] || []).map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </div>
        <div className="sort-filter__status-pills">
          <label>{t("home.status")}</label>
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
      </div>
      <div className="sort-filter__footer">
        <div className="sort-filter__actions">
          <button className="sort-filter__reset" onClick={onReset}>
            {t("common.resetFilters")}
          </button>
          {onFullRefreshTickets && (
            <button
              type="button"
              className="sort-filter__reset"
              onClick={onFullRefreshTickets}
              disabled={isFullRefreshDisabled}
            >
              {t("home.fullRefreshTickets")}
            </button>
          )}
          <ExportIssuesButton
            issues={(issues ?? []).map((i) => ({
              ...i,
              remainingEstimateSeconds: i.remainingEstimateSeconds ?? 0,
              issueType: i.issueType ?? "Task",
              project: i.project ?? "MECH",
              worklogs: i.worklogs ?? [],
            }))}
            disabled={isLoadingTickets}
          />
          <Link
            className="sort-filter__admin-login"
            href={isAdminSession ? "/admin" : "/login"}
          >
            {isAdminSession ? t("home.adminPanel") : t("home.adminLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
