"use client";

import "../../../../components/TicketCard/ticketCard.css";
import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import AdminTicketModal from "../../components/AdminTicketModal/AdminTicketModal";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { useIssues } from "@/lib/IssuesContext";
import type { NormalizedIssue } from "@/lib/jira";
import {
  formatCurrency,
  formatDateTimeForLocale,
  formatMachineDirectoryLabel,
  formatMachineKeyDisplay,
  formatSeconds,
  getAdminAssetHref,
  getMaintenanceDueLabel,
  parseMachineKey,
} from "../../adminShared";
import { useAdminAssetDetail } from "../../hooks/useAdminAssetDetail";
import { useAdminMaintenance } from "../../hooks/useAdminMaintenance";
import { useAdminSession } from "../../hooks/useAdminSession";

function AssetDetailPageContent() {
  const params = useParams<{ machineKey: string }>();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const { loadingInitial, fetchingAllTickets, error } = useJiraSearch();
  const { issues } = useIssues();
  const [selectedIssue, setSelectedIssue] = useState<NormalizedIssue | null>(null);

  const rawMachineKey = Array.isArray(params.machineKey)
    ? params.machineKey[0]
    : params.machineKey || "";
  const machineKey = useMemo(() => {
    try {
      return decodeURIComponent(rawMachineKey);
    } catch {
      return rawMachineKey;
    }
  }, [rawMachineKey]);

  const parsedMachine = useMemo(() => parseMachineKey(machineKey), [machineKey]);
  const fallbackMachineLabel = useMemo(
    () => formatMachineDirectoryLabel(parsedMachine) || machineKey,
    [machineKey, parsedMachine]
  );
  const machineKeyDisplay = useMemo(
    () => formatMachineKeyDisplay(machineKey),
    [machineKey]
  );

  const {
    currentUserIsAdmin,
    sessionResolved,
  } = useAdminSession(searchParams);

  const ticketsLoading = loadingInitial || fetchingAllTickets;
  const allIssues = useMemo(() => (issues ?? []) as NormalizedIssue[], [issues]);

  const {
    assetIssues,
    manualEntries,
    equipmentDetails,
    ticketCostsByIssue,
    assetDataLoading,
    assetDataError,
    repairCostTotal,
    manualCostTotal,
    reloadAssetData,
  } = useAdminAssetDetail({
    sessionResolved,
    currentUserIsAdmin,
    machineKey,
    allIssues,
    ticketsLoading,
  });

  const noopUpsertAssetDetailsCache = useCallback(() => {}, []);
  const {
    plannedMaintenanceItems,
    plannedMaintenanceLoading,
    plannedMaintenanceError,
    loadPlannedMaintenance,
    maintenanceBadgeCount,
  } = useAdminMaintenance({
    sessionResolved,
    currentUserIsAdmin,
    locale,
    t,
    machineLabelByKey: { [machineKey]: fallbackMachineLabel },
    upsertAssetDetailsCache: noopUpsertAssetDetailsCache,
  });

  const machineCategory =
    equipmentDetails?.category?.trim() || parsedMachine.category || t("common.unknown");
  const machineSubcategory =
    equipmentDetails?.subcategory?.trim() || parsedMachine.subcategory || t("common.unknown");
  const machineModel = equipmentDetails?.model?.trim() || "";
  const machineSerialNumber = equipmentDetails?.serialNumber?.trim() || "";
  const machineManufacturer = equipmentDetails?.manufacturer?.trim() || "";
  const machineLabel =
    formatMachineDirectoryLabel({
      category: machineCategory,
      subcategory: machineSubcategory,
    }) || machineKey;

  const assetMaintenanceItems = useMemo(
    () => plannedMaintenanceItems.filter((item) => item.machineKey === machineKey),
    [machineKey, plannedMaintenanceItems]
  );
  const plannedItems = useMemo(
    () => assetMaintenanceItems.filter((item) => !item.isCompleted),
    [assetMaintenanceItems]
  );
  const completedItems = useMemo(
    () => assetMaintenanceItems.filter((item) => item.isCompleted),
    [assetMaintenanceItems]
  );
  const maintenanceCostTotal = useMemo(
    () => assetMaintenanceItems.reduce((sum, item) => sum + (item.cost ?? 0), 0),
    [assetMaintenanceItems]
  );
  const loggedTimeTotal = useMemo(
    () => assetIssues.reduce((sum, issue) => sum + (issue.timeSpentSeconds ?? 0), 0),
    [assetIssues]
  );
  const sortedAssetIssues = useMemo(
    () =>
      [...assetIssues].sort((a, b) =>
        String(b.created || "").localeCompare(String(a.created || ""))
      ),
    [assetIssues]
  );

  const handleModalDataChanged = useCallback(() => {
    void reloadAssetData();
    void loadPlannedMaintenance();
  }, [loadPlannedMaintenance, reloadAssetData]);

  return (
    <>
      {!sessionResolved && (
        <div className="admin-card">
          <div className="page__loading">{t("common.loading")}</div>
        </div>
      )}

      {sessionResolved && !currentUserIsAdmin && (
        <div className="admin-card">
          <h1 className="admin-title">{t("admin.accessDeniedTitle")}</h1>
          <p className="admin-subtitle">{t("admin.accessDeniedSubtitle")}</p>
        </div>
      )}

      {sessionResolved && currentUserIsAdmin && (
        <div className="admin-dashboard">
              <div className="admin-card">
                <div className="admin-asset-header">
                  <div className="admin-asset-header__top">
                    <div className="admin-asset-header__text">
                      <h1 className="admin-title">{machineLabel}</h1>
                      <p className="admin-subtitle">{t("admin.assetDetailSubtitle")}</p>
                      <div className="admin-asset-header__meta">
                        <span>{machineCategory}</span>
                        <span className="admin-asset-header__separator">/</span>
                        <span>{machineSubcategory}</span>
                      </div>
                    </div>
                    <div className="page__content-actions">
                      <Link href="/admin?view=inventory" className="page__action-link">
                        {t("admin.backToAdmin")}
                      </Link>
                    </div>
                  </div>
                  <div className="admin-asset-header__details">
                    <div className="admin-asset-field">
                      <span className="admin-asset-field__label">{t("admin.machineKey")}</span>
                      <span className="admin-asset-field__value" title={machineKey}>
                        {machineKeyDisplay}
                      </span>
                    </div>
                    <div className="admin-asset-field">
                      <span className="admin-asset-field__label">{t("admin.model")}</span>
                      <span className="admin-asset-field__value">{machineModel || "-"}</span>
                    </div>
                    <div className="admin-asset-field">
                      <span className="admin-asset-field__label">{t("admin.serialNumber")}</span>
                      <span className="admin-asset-field__value">
                        {machineSerialNumber || "-"}
                      </span>
                    </div>
                    <div className="admin-asset-field">
                      <span className="admin-asset-field__label">{t("admin.manufacturer")}</span>
                      <span className="admin-asset-field__value">
                        {machineManufacturer || "-"}
                      </span>
                    </div>
                  </div>
                </div>
                {(error || assetDataError || plannedMaintenanceError) && (
                  <div className="page__error">
                    {String(error || assetDataError || plannedMaintenanceError)}
                  </div>
                )}
              </div>

              <div className="admin-panel">
                <div className="admin-chart-title">{t("admin.assetOverview")}</div>
                <div className="admin-stats admin-stats--asset">
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.tickets")}</div>
                    <div className="admin-stat-value">{assetIssues.length}</div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.loggedTime")}</div>
                    <div className="admin-stat-value">{formatSeconds(loggedTimeTotal, locale)}</div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.repairCostByMachine")}</div>
                    <div className="admin-stat-value">
                      {formatCurrency(repairCostTotal, locale)}
                    </div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.manualEntriesTotal")}</div>
                    <div className="admin-stat-value">
                      {formatCurrency(manualCostTotal, locale)}
                    </div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.maintenanceCostTotal")}</div>
                    <div className="admin-stat-value">
                      {formatCurrency(maintenanceCostTotal, locale)}
                    </div>
                  </div>
                  <div className="admin-stat">
                    <div className="admin-stat-label">{t("admin.maintenancePlans")}</div>
                    <div className="admin-stat-value">{assetMaintenanceItems.length}</div>
                  </div>
                </div>
              </div>

              <div className="admin-asset-grid">
                <div className="admin-panel admin-asset-grid__full">
                  <div className="admin-chart-title">{t("admin.breakdownTickets")}</div>
                  {(ticketsLoading || assetDataLoading) && (
                    <div className="admin-chart-empty">{t("common.loading")}</div>
                  )}
                  {!ticketsLoading && !assetDataLoading && assetIssues.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noAssetTickets")}</div>
                  )}
                  {!ticketsLoading && !assetDataLoading && assetIssues.length > 0 && (
                    <div className="admin-asset-ticket-list">
                      {sortedAssetIssues.map((issue) => (
                        <button
                          key={issue.key}
                          type="button"
                          className="ticket-card ticket-card--list admin-asset-ticket-card"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <div className="ticket-card__list-field ticket-card__list-field--key">
                            {issue.key}
                          </div>
                          <div className="ticket-card__list-field ticket-card__list-field--summary admin-asset-ticket__summary">
                            {issue.summary}
                          </div>
                          <div className="ticket-card__list-field admin-asset-ticket-card__status">
                            {issue.status || t("common.unknown")}
                          </div>
                          <div className="ticket-card__list-field admin-asset-ticket-card__time">
                            {formatSeconds(issue.timeSpentSeconds ?? 0, locale)}
                          </div>
                          <div className="ticket-card__list-field admin-asset-ticket-card__cost">
                            {formatCurrency(ticketCostsByIssue[issue.key]?.amount ?? 0, locale)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.manualCostEntries")}</div>
                  {(ticketsLoading || assetDataLoading) && (
                    <div className="admin-chart-empty">{t("common.loading")}</div>
                  )}
                  {!ticketsLoading && !assetDataLoading && manualEntries.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noManualEntriesYet")}</div>
                  )}
                  {!ticketsLoading && !assetDataLoading && manualEntries.length > 0 && (
                    <div className="admin-asset-list">
                      {manualEntries.map((entry) => (
                        <div key={entry.id} className="admin-manual-row">
                          <div>{entry.date}</div>
                          <div>{formatCurrency(entry.amount, locale)}</div>
                          <div>{entry.comment}</div>
                          <div>{formatDateTimeForLocale(entry.createdAt, locale)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.plannedMaintenance")}</div>
                  {plannedMaintenanceLoading && (
                    <div className="admin-chart-empty">{t("common.loading")}</div>
                  )}
                  {!plannedMaintenanceLoading && plannedItems.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noPlannedMaintenanceForAsset")}
                    </div>
                  )}
                  {!plannedMaintenanceLoading && plannedItems.length > 0 && (
                    <div className="admin-asset-list">
                      {plannedItems.map((item) => (
                        <div key={item.id} className="admin-asset-maintenance-row">
                          <div className="admin-asset-maintenance-row__main">
                            <div className="admin-asset-maintenance-row__title">{item.title}</div>
                            <div className="admin-asset-maintenance-row__meta">
                              {getMaintenanceDueLabel(item.dueDate, t)}
                            </div>
                          </div>
                          <div className="admin-asset-maintenance-row__cost">
                            {item.cost == null ? "-" : formatCurrency(item.cost, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.completedMaintenance")}</div>
                  {plannedMaintenanceLoading && (
                    <div className="admin-chart-empty">{t("common.loading")}</div>
                  )}
                  {!plannedMaintenanceLoading && completedItems.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noCompletedMaintenanceForAsset")}
                    </div>
                  )}
                  {!plannedMaintenanceLoading && completedItems.length > 0 && (
                    <div className="admin-asset-list">
                      {completedItems.map((item) => (
                        <div key={item.id} className="admin-asset-maintenance-row">
                          <div className="admin-asset-maintenance-row__main">
                            <div className="admin-asset-maintenance-row__title">{item.title}</div>
                            <div className="admin-asset-maintenance-row__meta">
                              {item.completedAt
                                ? formatDateTimeForLocale(item.completedAt, locale)
                                : item.dueDate}
                            </div>
                          </div>
                          <div className="admin-asset-maintenance-row__cost">
                            {item.cost == null ? "-" : formatCurrency(item.cost, locale)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
        </div>
      )}

      <AdminTicketModal
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        issue={selectedIssue}
        onDataChanged={handleModalDataChanged}
      />
    </>
  );
}

export default function AssetDetailPage() {
  return (
    <Suspense fallback={null}>
      <AssetDetailPageContent />
    </Suspense>
  );
}
