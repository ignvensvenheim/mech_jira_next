"use client";

import { DEPARTMENT_LINES, type DatePreset } from "../adminShared";
import type { AdminTranslate } from "../adminShared";

type AdminFiltersProps = {
  category: string;
  subCategory: string;
  dateFrom: string;
  dateTo: string;
  searchText?: string;
  subCategoryOptions: string[];
  activeDatePreset: DatePreset;
  resetDisabled: boolean;
  isFullRefreshDisabled?: boolean;
  onCategoryChange: (value: string) => void;
  onSubCategoryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
  onApplyAllTickets: () => void;
  onApplyLastSevenDays: () => void;
  onApplyThisMonth: () => void;
  onApplyLastMonth: () => void;
  onApplyLastSixMonths: () => void;
  onResetFilters: () => void;
  onFullRefreshTickets?: () => void;
  t: AdminTranslate;
  className?: string;
};

export default function AdminFilters({
  category,
  subCategory,
  dateFrom,
  dateTo,
  searchText = "",
  subCategoryOptions,
  activeDatePreset,
  resetDisabled,
  isFullRefreshDisabled = false,
  onCategoryChange,
  onSubCategoryChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onApplyAllTickets,
  onApplyLastSevenDays,
  onApplyThisMonth,
  onApplyLastMonth,
  onApplyLastSixMonths,
  onResetFilters,
  onFullRefreshTickets,
  t,
  className = "",
}: AdminFiltersProps) {
  return (
    <div className={`admin-filters ${className}`.trim()}>
      {onSearchChange ? (
        <label className="admin-filter admin-filter--search">
          <div className="admin-label">{t("home.search")}</div>
          <input
            type="search"
            className="admin-input"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("home.searchPlaceholder")}
          />
        </label>
      ) : null}

      <label className="admin-filter">
        <div className="admin-label">{t("home.category")}</div>
        <select
          className="admin-input"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">{t("common.all")}</option>
          {Object.keys(DEPARTMENT_LINES).map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-filter">
        <div className="admin-label">{t("home.subcategory")}</div>
        <select
          className="admin-input"
          value={subCategory}
          onChange={(event) => onSubCategoryChange(event.target.value)}
        >
          <option value="">{t("common.all")}</option>
          {subCategoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-filter">
        <div className="admin-label">{t("common.dateFrom")}</div>
        <input
          type="date"
          className="admin-input"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
        />
      </label>

      <label className="admin-filter">
        <div className="admin-label">{t("common.dateTo")}</div>
        <input
          type="date"
          className="admin-input"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
        />
      </label>

      <div className="admin-filters-actions">
        <div className="admin-filters-presets">
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "all" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyAllTickets}
          >
            {t("common.allTickets")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "last7" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyLastSevenDays}
          >
            {t("common.last7Days")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "thisMonth" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyThisMonth}
          >
            {t("common.thisMonth")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "lastMonth" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyLastMonth}
          >
            {t("common.lastMonth")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "last6Months"
                ? " admin-reset-button--active"
                : ""
            }`}
            onClick={onApplyLastSixMonths}
          >
            {t("common.last6Months")}
          </button>
        </div>
        <button
          type="button"
          className="admin-reset-button"
          onClick={onResetFilters}
          disabled={resetDisabled}
        >
          {t("common.resetFilters")}
        </button>
        {onFullRefreshTickets ? (
          <button
            type="button"
            className="admin-reset-button"
            onClick={onFullRefreshTickets}
            disabled={isFullRefreshDisabled}
          >
            {t("home.fullRefreshTickets")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
