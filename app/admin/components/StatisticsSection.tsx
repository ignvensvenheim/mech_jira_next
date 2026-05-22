"use client";

import Link from "next/link";
import { formatCurrency, formatSeconds, getMaintenanceCountLabel, getTicketCountLabel } from "../adminShared";
import {
  type AdminTranslate,
  type AssetStatisticsRow,
  type DatePreset,
  getAdminAssetHref,
  type TicketFixCost,
} from "../adminShared";
import type { NormalizedIssue } from "@/lib/jira";
import AdminFilters from "./AdminFilters";

type CategoryRow = {
  name: string;
  tickets: number;
  seconds: number;
};

type StatisticsSectionProps = {
  locale: string;
  t: AdminTranslate;
  statisticsTimeframeLabel: string;
  statisticsCategory: string;
  statisticsSubCategory: string;
  statisticsDateFrom: string;
  statisticsDateTo: string;
  statisticsSubCategoryOptions: string[];
  statisticsActiveDatePreset: DatePreset;
  filteredIssues: NormalizedIssue[];
  statisticsTotalTimeSeconds: number;
  statisticsTrackedCost: number;
  plannedMaintenanceItemsLength: number;
  statisticsMaintenanceActiveCount: number;
  statisticsMaintenanceCompletedCount: number;
  statisticsMaintenanceCost: number;
  ticketsByCategory: CategoryRow[];
  maxCategoryTickets: number;
  machinesByBreakdowns: AssetStatisticsRow[];
  maxMachineBreakdowns: number;
  machinesByRepairCost: AssetStatisticsRow[];
  maxMachineRepairCost: number;
  machinesByMaintenanceCost: AssetStatisticsRow[];
  maxMachineMaintenanceCost: number;
  topTicketsByTime: NormalizedIssue[];
  ticketCostsByIssue: Record<string, TicketFixCost>;
  onCategoryChange: (value: string) => void;
  onSubCategoryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyAllTickets: () => void;
  onApplyLastSevenDays: () => void;
  onApplyThisMonth: () => void;
  onApplyLastMonth: () => void;
  onApplyLastSixMonths: () => void;
  onResetFilters: () => void;
  onSetSelectedIssue: (issue: NormalizedIssue) => void;
};

export default function StatisticsSection({
  locale,
  t,
  statisticsTimeframeLabel,
  statisticsCategory,
  statisticsSubCategory,
  statisticsDateFrom,
  statisticsDateTo,
  statisticsSubCategoryOptions,
  statisticsActiveDatePreset,
  filteredIssues,
  statisticsTotalTimeSeconds,
  statisticsTrackedCost,
  plannedMaintenanceItemsLength,
  statisticsMaintenanceActiveCount,
  statisticsMaintenanceCompletedCount,
  statisticsMaintenanceCost,
  ticketsByCategory,
  maxCategoryTickets,
  machinesByBreakdowns,
  maxMachineBreakdowns,
  machinesByRepairCost,
  maxMachineRepairCost,
  machinesByMaintenanceCost,
  maxMachineMaintenanceCost,
  topTicketsByTime,
  ticketCostsByIssue,
  onCategoryChange,
  onSubCategoryChange,
  onDateFromChange,
  onDateToChange,
  onApplyAllTickets,
  onApplyLastSevenDays,
  onApplyThisMonth,
  onApplyLastMonth,
  onApplyLastSixMonths,
  onResetFilters,
  onSetSelectedIssue,
}: StatisticsSectionProps) {
  return (
    <>
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.statistics")}</h1>
        <p className="admin-subtitle">{t("admin.statisticsSubtitle")}</p>
        <p className="admin-subtitle">{statisticsTimeframeLabel}</p>

        <AdminFilters
          className="admin-filters--compact"
          category={statisticsCategory}
          subCategory={statisticsSubCategory}
          dateFrom={statisticsDateFrom}
          dateTo={statisticsDateTo}
          subCategoryOptions={statisticsSubCategoryOptions}
          activeDatePreset={statisticsActiveDatePreset}
          resetDisabled={
            !statisticsCategory &&
            !statisticsSubCategory &&
            !statisticsDateFrom &&
            !statisticsDateTo
          }
          onCategoryChange={(value) => {
            onCategoryChange(value);
            onSubCategoryChange("");
          }}
          onSubCategoryChange={onSubCategoryChange}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          onApplyAllTickets={onApplyAllTickets}
          onApplyLastSevenDays={onApplyLastSevenDays}
          onApplyThisMonth={onApplyThisMonth}
          onApplyLastMonth={onApplyLastMonth}
          onApplyLastSixMonths={onApplyLastSixMonths}
          onResetFilters={onResetFilters}
          t={t}
        />
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.repairStatistics")}</div>
        <div className="admin-stats">
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.tickets")}</div>
            <div className="admin-stat-value">{filteredIssues.length}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.loggedTime")}</div>
            <div className="admin-stat-value">{formatSeconds(statisticsTotalTimeSeconds, locale)}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.trackedCost")}</div>
            <div className="admin-stat-value">{formatCurrency(statisticsTrackedCost, locale)}</div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.maintenanceStatistics")}</div>
        <div className="admin-stats">
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.maintenancePlans")}</div>
            <div className="admin-stat-value">{plannedMaintenanceItemsLength}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.activeMaintenancePlans")}</div>
            <div className="admin-stat-value">{statisticsMaintenanceActiveCount}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.completedMaintenancePlans")}</div>
            <div className="admin-stat-value">{statisticsMaintenanceCompletedCount}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">{t("admin.maintenanceCostTotal")}</div>
            <div className="admin-stat-value">{formatCurrency(statisticsMaintenanceCost, locale)}</div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.ticketsByCategory")}</div>
        {ticketsByCategory.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noTicketData")}</div>
        )}
        {ticketsByCategory.map((row) => {
          const width = (row.tickets / maxCategoryTickets) * 100;
          const barTitle = `${row.name}: ${getTicketCountLabel(t, row.tickets)} (${Math.round(
            width
          )}% of the busiest category)`;
          return (
            <div key={row.name} className="admin-chart-row">
              <div className="admin-chart-label">{row.name}</div>
              <div className="admin-chart-bar" title={barTitle}>
                <div className="admin-chart-bar-fill" style={{ width: `${width}%` }} />
              </div>
              <div className="admin-chart-value">{getTicketCountLabel(t, row.tickets)}</div>
              <div className="admin-chart-money">{formatSeconds(row.seconds, locale)}</div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.breakdownsByMachine")}</div>
        {machinesByBreakdowns.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noMachineBreakdownData")}</div>
        )}
        {machinesByBreakdowns.map((row) => {
          const width = (row.breakdowns / maxMachineBreakdowns) * 100;
          const barTitle = `${row.label}: ${t("admin.breakdownsCount", {
            count: row.breakdowns,
          })} (${Math.round(width)}% of the highest breakdown count)`;
          return (
            <div key={row.key} className="admin-chart-row">
              <Link href={getAdminAssetHref(row.key)} className="admin-chart-label admin-inline-link">
                {row.label}
              </Link>
              <div className="admin-chart-bar" title={barTitle}>
                <div className="admin-chart-bar-fill" style={{ width: `${width}%` }} />
              </div>
              <div className="admin-chart-value">
                {t("admin.breakdownsCount", { count: row.breakdowns })}
              </div>
              <div className="admin-chart-money">{formatCurrency(row.repairCost, locale)}</div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.repairCostByMachine")}</div>
        {machinesByRepairCost.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noRepairCostData")}</div>
        )}
        {machinesByRepairCost.map((row) => {
          const width = (row.repairCost / maxMachineRepairCost) * 100;
          const barTitle = `${row.label}: ${formatCurrency(
            row.repairCost,
            locale
          )} (${Math.round(width)}% of the highest repair cost)`;
          return (
            <div key={row.key} className="admin-chart-row">
              <Link href={getAdminAssetHref(row.key)} className="admin-chart-label admin-inline-link">
                {row.label}
              </Link>
              <div className="admin-chart-bar" title={barTitle}>
                <div className="admin-chart-bar-fill" style={{ width: `${width}%` }} />
              </div>
              <div className="admin-chart-value">{formatCurrency(row.repairCost, locale)}</div>
              <div className="admin-chart-money">
                {t("admin.breakdownsCount", { count: row.breakdowns })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.maintenanceCostByMachine")}</div>
        {machinesByMaintenanceCost.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noMaintenanceCostData")}</div>
        )}
        {machinesByMaintenanceCost.map((row) => {
          const width = (row.maintenanceCost / maxMachineMaintenanceCost) * 100;
          const barTitle = `${row.label}: ${formatCurrency(
            row.maintenanceCost,
            locale
          )} (${Math.round(width)}% of the highest maintenance cost)`;
          return (
            <div key={row.key} className="admin-chart-row">
              <Link href={getAdminAssetHref(row.key)} className="admin-chart-label admin-inline-link">
                {row.label}
              </Link>
              <div className="admin-chart-bar" title={barTitle}>
                <div className="admin-chart-bar-fill" style={{ width: `${width}%` }} />
              </div>
              <div className="admin-chart-value">{formatCurrency(row.maintenanceCost, locale)}</div>
              <div className="admin-chart-money">{getMaintenanceCountLabel(t, row.maintenanceCount)}</div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.topTicketsByLoggedTime")}</div>
        {topTicketsByTime.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noTicketsFound")}</div>
        )}
        {topTicketsByTime.map((issue) => (
          <button
            key={issue.key}
            type="button"
            className="admin-ticket-open admin-chart-row admin-chart-row--tickets"
            onClick={() => onSetSelectedIssue(issue)}
          >
            <div className="admin-chart-label">{issue.key}</div>
            <div className="admin-ticket-summary">{issue.summary}</div>
            <div className="admin-chart-value">
              {formatSeconds(issue.timeSpentSeconds ?? 0, locale)}
            </div>
            <div className="admin-chart-money">
              {ticketCostsByIssue[issue.key]
                ? formatCurrency(ticketCostsByIssue[issue.key].amount, locale)
                : "-"}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
